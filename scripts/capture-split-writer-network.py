#!/usr/bin/env python3
"""Prove direct bridge ownership; emit only inert identities, never environment secrets."""
import ipaddress
import json
import re
import sys
from urllib.parse import urlsplit

sys.stdout.reconfigure(newline="\n")


def ensure(condition):
    if not condition:
        raise ValueError("unproven network identity")


def addresses(member):
    return [str(ipaddress.ip_interface(member[key]).ip) for key in ("IPv4Address", "IPv6Address") if member.get(key)]


def network(identity, values):
    matched = [value for value in values if value["Id"] == identity]
    ensure(len(matched) == 1)
    value = matched[0]
    ensure(value["Id"] == identity and value["Driver"] == "bridge" and value["Scope"] == "local")
    return value


def capture(project, ids, inspected):
    containers = inspected["containers"]
    ensure(len(containers) == len(ids) + 1)
    postgres = containers[0]
    ensure(postgres["State"]["Running"] is True)
    ensure(postgres["Config"]["Labels"]["com.docker.compose.project"] == project)
    ensure(postgres["Config"]["Labels"]["com.docker.compose.service"] == "postgres")
    ensure(postgres["HostConfig"]["NetworkMode"] not in ("host", "none"))
    # Production PostgreSQL has exactly the private backend network, no published DB port.
    ensure(not any(postgres["NetworkSettings"].get("Ports", {}).values()))
    pg_networks = postgres["NetworkSettings"]["Networks"]
    ensure(len(pg_networks) == 1)
    name, pg_endpoint = next(iter(pg_networks.items()))
    net = network(pg_endpoint["NetworkID"], inspected["network"])
    ensure("postgres" in pg_endpoint["Aliases"])
    ensure(postgres["Id"] in net["Containers"])
    pg_addresses = addresses(net["Containers"][postgres["Id"]])
    ensure(pg_addresses and sorted(pg_addresses) == sorted(str(ipaddress.ip_address(pg_endpoint[key])) for key in ("IPAddress", "GlobalIPv6Address") if pg_endpoint.get(key)))
    result = {"network": net["Id"], "postgres": postgres["Id"], "writers": []}
    for identity in ids:
        ensure(re.fullmatch(r"[0-9a-f]{64}", identity))
        writer = next(value for value in containers[1:] if value["Id"] == identity)
        ensure(writer["Id"] == identity and writer["State"]["Running"] is True)
        labels = writer["Config"]["Labels"]
        ensure(labels["com.docker.compose.project"] == project)
        ensure(labels["com.docker.compose.service"] in ("web", "bot"))
        ensure(writer["HostConfig"]["NetworkMode"] not in ("host", "none"))
        # URL text alone cannot prove the endpoint: /etc/hosts overrides Docker DNS.
        ensure(not any(entry.split(":", 1)[0].strip().rstrip(".").lower() == "postgres" for entry in (writer["HostConfig"].get("ExtraHosts") or [])))
        ensure(not any(writer["HostConfig"].get(key) for key in ("Dns", "DnsSearch", "DnsOptions")))
        urls = [item.split("=", 1)[1] for item in writer["Config"]["Env"] if item.startswith("DATABASE_URL=")]
        ensure(len(urls) == 1)
        url = urlsplit(urls[0])
        ensure(url.scheme in ("postgres", "postgresql") and url.hostname == "postgres")
        ensure(url.port == 5432 and url.path == "/volleytime" and url.username == "volley")
        ensure(not url.query and not url.fragment)
        # Docker DNS searches all attached networks. Prove there is only the captured
        # PostgreSQL endpoint, including aliases of OTHER containers on frontend.
        candidates = set()
        resolution = {value["Id"]: value for value in inspected["resolution"]}
        for attached_name, attached in writer["NetworkSettings"]["Networks"].items():
            attached_net = network(attached["NetworkID"], inspected["network"])
            ensure(identity in attached_net["Containers"])
            for member_id in attached_net["Containers"]:
                member = resolution[member_id]
                member_endpoint = member["NetworkSettings"]["Networks"][attached_name]
                ensure(member_endpoint["NetworkID"] == attached_net["Id"])
                aliases = (member_endpoint.get("Aliases") or []) + (member_endpoint.get("DNSNames") or [])
                aliases.append(member.get("Name", "").lstrip("/"))
                if any(alias.rstrip(".").lower() == "postgres" for alias in aliases):
                    candidates.add(member_id)
        ensure(candidates == {postgres["Id"]})
        endpoint = writer["NetworkSettings"]["Networks"][name]
        ensure(endpoint["NetworkID"] == net["Id"])
        owned = addresses(net["Containers"][identity])
        actual = [str(ipaddress.ip_address(endpoint[key])) for key in ("IPAddress", "GlobalIPv6Address") if endpoint.get(key)]
        ensure(owned and sorted(owned) == sorted(actual))
        result["writers"].append({"id": identity, "addresses": owned})
    validate(result, inspected["network"])
    return result


def validate(value, inspected):
    ensure(re.fullmatch(r"[0-9a-f]{64}", value["network"]))
    ensure(re.fullmatch(r"[0-9a-f]{64}", value["postgres"]))
    net = network(value["network"], inspected)
    ensure(value["postgres"] in net["Containers"])
    owners = {}
    for writer in value["writers"]:
        ensure(re.fullmatch(r"[0-9a-f]{64}", writer["id"]) and writer["addresses"])
        for raw in writer["addresses"]:
            address = str(ipaddress.ip_address(raw))
            ensure(address == raw and (address not in owners or owners[address] == writer["id"]))
            owners[address] = writer["id"]
    ensure(owners)
    # A stopped endpoint may disappear; its address MUST NOT have been reassigned.
    for identity, member in net["Containers"].items():
        for address in addresses(member):
            ensure(address not in owners or owners[address] == identity)
    return owners


try:
    if sys.argv[1] == "attached-network-ids":
        identities = {endpoint["NetworkID"] for container in json.load(sys.stdin) for endpoint in container["NetworkSettings"]["Networks"].values()}
        ensure(identities and all(re.fullmatch(r"[0-9a-f]{64}", identity) for identity in identities))
        print("\n".join(sorted(identities)))
    elif sys.argv[1] == "network-member-ids":
        identities = {identity for value in json.load(sys.stdin) for identity in value["Containers"]}
        ensure(identities and all(re.fullmatch(r"[0-9a-f]{64}", identity) for identity in identities))
        print("\n".join(sorted(identities)))
    elif sys.argv[1] == "network-id":
        if len(sys.argv) == 3:
            with open(sys.argv[2], encoding="utf-8") as source:
                identity = json.load(source)["network"]
        else:
            values = json.load(sys.stdin)[0]["NetworkSettings"]["Networks"]
            ensure(len(values) == 1)
            identity = next(iter(values.values()))["NetworkID"]
        ensure(re.fullmatch(r"[0-9a-f]{64}", identity))
        print(identity)
    elif sys.argv[1] == "predicate":
        with open(sys.argv[2], encoding="utf-8") as source:
            owners = validate(json.load(source), json.load(sys.stdin))
        print("client_addr IN (" + ",".join("'" + address + "'::inet" for address in sorted(owners)) + ")")
    else:
        ensure(sys.argv[1] == "capture" and len(sys.argv) > 3)
        print(json.dumps(capture(sys.argv[2], sys.argv[3:], json.load(sys.stdin))))
except Exception as error:
    # Do not print inspect/env/URL or raw exception data: these may contain credentials.
    print("split rollback: direct PostgreSQL writer network ownership is unproven (" + type(error).__name__ + ")", file=sys.stderr)
    sys.exit(1)
