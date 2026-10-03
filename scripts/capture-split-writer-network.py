#!/usr/bin/env python3
"""Prove direct bridge ownership; emit only inert identities, never environment secrets."""
import ipaddress
import json
import re
import sys
from urllib.parse import urlsplit


def ensure(condition):
    if not condition:
        raise ValueError("unproven network identity")


def addresses(member):
    return [str(ipaddress.ip_interface(member[key]).ip) for key in ("IPv4Address", "IPv6Address") if member.get(key)]


def network(identity, values):
    ensure(len(values) == 1)
    value = values[0]
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
        urls = [item.split("=", 1)[1] for item in writer["Config"]["Env"] if item.startswith("DATABASE_URL=")]
        ensure(len(urls) == 1)
        url = urlsplit(urls[0])
        ensure(url.scheme in ("postgres", "postgresql") and url.hostname == "postgres")
        ensure(url.port == 5432 and url.path == "/volleytime" and url.username == "volley")
        ensure(not url.query and not url.fragment)
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
    if sys.argv[1] == "network-id":
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
