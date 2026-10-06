export type LandingPageSettings = {
  backgroundMode: "original" | "color" | "image";
  backgroundColor: string;
  backgroundImageDataUrl: string | null;
  logoDataUrl: string | null;
  logoX: number;
  logoY: number;
  images: LandingPageImage[];
  welcomeEnabled: boolean;
  welcomeText: string;
  welcomeX: number;
  welcomeY: number;
  welcomeFontFamily: string;
  welcomeFontSize: number;
  welcomeColor: string;
};

export type LandingPageImage = {
  id: string;
  dataUrl: string;
  x: number;
  y: number;
  width: number;
};

export const defaultLandingPageSettings: LandingPageSettings = {
  backgroundMode: "original",
  backgroundColor: "#09000f",
  backgroundImageDataUrl: null,
  logoDataUrl: null,
  logoX: 50,
  logoY: 24,
  images: [],
  welcomeEnabled: false,
  welcomeText: "",
  welcomeX: 50,
  welcomeY: 50,
  welcomeFontFamily: "system-ui",
  welcomeFontSize: 32,
  welcomeColor: "#ffffff",
};
