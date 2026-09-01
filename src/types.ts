export interface UIComponentItem {
  id: string;
  name: string;
  category: 'buttons' | 'cards' | 'feedback' | 'navigation' | 'data';
  description: string;
  classes: string;
  previewCode: string;
}

export type ThemePreset = {
  id: string;
  name: string;
  primary: string;
  secondary: string;
  accent: string;
  bg: string;
  text: string;
  cardBg: string;
};

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'info' | 'warning';
}
