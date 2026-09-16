import { Dimensions } from 'react-native';

export const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export const getResponsive = (width, height) => {
  const horizontalPadding = clamp(width * 0.06, 16, 32);

  return {
    width,
    height,
    horizontalPadding,
    contentWidth: Math.min(width - horizontalPadding * 2, 720),
    cardPadding: clamp(width * 0.05, 16, 28),
    heroHeight: clamp(height * 0.3, 220, 320),
    cardOverlap: clamp(width * 0.09, 28, 40),
    qrSize: clamp(Math.min(width * 0.58, height * 0.45), 160, 280),
    isCompact: width < 360,
  };
};

export const getInitialResponsive = () => {
  const { width, height } = Dimensions.get('window');
  return getResponsive(width, height);
};