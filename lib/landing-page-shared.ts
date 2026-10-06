export type LandingPageSettings = {
  logoDataUrl: string | null;
  logoX: number;
  logoY: number;
  welcomeEnabled: boolean;
  welcomeText: string;
  welcomeX: number;
  welcomeY: number;
};

export const defaultLandingPageSettings: LandingPageSettings = {
  logoDataUrl: null,
  logoX: 50,
  logoY: 24,
  welcomeEnabled: false,
  welcomeText: "",
  welcomeX: 50,
  welcomeY: 50,
};
