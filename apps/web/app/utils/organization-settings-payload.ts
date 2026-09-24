interface OrganizationSettingsForm {
  name: string
  city: string
  description: string
  defaultMemberStatus: 'active' | 'pending'
  subscriptionsEnabled: boolean
}

export function organizationSettingsPayload(
  form: OrganizationSettingsForm,
  confirmedSubscriptionsEnabled: boolean,
) {
  return {
    name: form.name.trim(),
    city: form.city.trim() || null,
    description: form.description.trim() || null,
    defaultMemberStatus: form.defaultMemberStatus,
    ...(form.subscriptionsEnabled !== confirmedSubscriptionsEnabled
      ? { subscriptionsEnabled: form.subscriptionsEnabled }
      : {}),
  }
}
