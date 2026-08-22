import { isCottiProfessionalModel } from '@/_custom/registry/modelDisplayConfig';
import type { ModelDisplayOption } from '@/types/modelDisplay';

export const getProfessionalModelMatchOptions = (options: ModelDisplayOption[]) =>
  options.filter(isCottiProfessionalModel).map(({ label, model }) => ({ label, value: model }));
