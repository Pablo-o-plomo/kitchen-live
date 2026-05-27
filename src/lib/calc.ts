export const calcMetrics = (costPrice: number, salePrice: number) => {
  const markupRub = salePrice - costPrice;
  const markupPercent = costPrice === 0 ? 0 : (markupRub / costPrice) * 100;
  const foodCostPercent = salePrice === 0 ? 0 : (costPrice / salePrice) * 100;
  return { markupRub, markupPercent, foodCostPercent };
};
