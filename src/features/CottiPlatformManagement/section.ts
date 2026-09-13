export type CottiPlatformManagementSection =
  'agent-access' | 'audit' | 'home-notification' | 'models' | 'overview';

const SECTIONS = new Set<CottiPlatformManagementSection>([
  'agent-access',
  'audit',
  'home-notification',
  'models',
  'overview',
]);

export const parseCottiPlatformManagementSection = (
  searchParams: URLSearchParams,
): CottiPlatformManagementSection => {
  const raw = searchParams.get('section');
  const section = raw === 'usage' ? 'overview' : raw === 'people' ? 'agent-access' : raw;

  return SECTIONS.has(section as CottiPlatformManagementSection)
    ? (section as CottiPlatformManagementSection)
    : 'overview';
};

export const writeCottiPlatformManagementSection = (
  current: URLSearchParams,
  section: CottiPlatformManagementSection,
) => {
  const next = new URLSearchParams(current);

  if (section === 'overview') next.delete('section');
  else next.set('section', section);

  return next;
};
