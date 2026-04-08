const EMAIL_DOMAIN_ALIAS_GROUPS = [
  ['abite.com', 'cotticoffee.com'],
] as const;

const EMAIL_CANONICAL_DOMAIN_MAP = new Map<string, string>(
  EMAIL_DOMAIN_ALIAS_GROUPS.flatMap(([canonicalDomain, ...aliasDomains]) => [
    [canonicalDomain, canonicalDomain],
    ...aliasDomains.map((aliasDomain) => [aliasDomain, canonicalDomain] as const),
  ]),
);

export const normalizeEmailInput = (value: string) => value.trim().toLowerCase();

export const normalizeEmailDomainAlias = (domain: string) => {
  const normalizedDomain = normalizeEmailInput(domain);
  return EMAIL_CANONICAL_DOMAIN_MAP.get(normalizedDomain) || normalizedDomain;
};

export const normalizeEmailIdentity = (email: string) => {
  const normalizedEmail = normalizeEmailInput(email);
  const emailParts = normalizedEmail.split('@');

  if (emailParts.length !== 2) return normalizedEmail;

  const [localPart, domain] = emailParts;
  if (!localPart || !domain) return normalizedEmail;

  return `${localPart}@${normalizeEmailDomainAlias(domain)}`;
};

export const areEmailsEquivalent = (left: string, right: string) =>
  normalizeEmailIdentity(left) === normalizeEmailIdentity(right);
