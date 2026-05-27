export type RawRow = Record<string, unknown>;

const normalize = (v: unknown) =>
  String(v ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[ё]/g, 'е');

function getByAliases(row: RawRow, aliases: string[]) {
  const entries = Object.entries(row);
  for (const alias of aliases) {
    const found = entries.find(([k]) => normalize(k) === normalize(alias));
    if (found) return found[1];
  }
  return undefined;
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  const cleaned = String(value ?? '')
    .replace(/\s/g, '')
    .replace(',', '.')
    .replace(/[^\d.-]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export function mapMenuImportRow(row: RawRow) {
  return {
    category: String(getByAliases(row, ['Категория', 'Группа', 'Раздел', 'category']) ?? 'Без категории').trim(),
    name: String(getByAliases(row, ['Название блюда', 'Блюдо', 'Номенклатура', 'name']) ?? '').trim(),
    costPrice: toNumber(getByAliases(row, ['Себестоимость', 'Фудкост', 'costPrice', 'cost'])),
    salePrice: toNumber(getByAliases(row, ['Продажная цена', 'Цена продажи', 'Цена', 'salePrice', 'price'])),
    startDate: String(getByAliases(row, ['Дата начала', 'Дата действия', 'startDate']) ?? '').trim(),
    comment: String(getByAliases(row, ['Комментарий', 'Примечание', 'comment']) ?? '').trim(),
  };
}

export function mapSalesImportRow(row: RawRow) {
  return {
    name: String(getByAliases(row, ['Название блюда', 'Блюдо', 'Номенклатура', 'name']) ?? '').trim(),
    quantitySold: toNumber(getByAliases(row, ['Количество продаж', 'Кол-во', 'quantitySold', 'qty'])),
    revenue: toNumber(getByAliases(row, ['Выручка', 'Сумма', 'revenue'])),
    periodStart: String(getByAliases(row, ['periodStart', 'Начало периода', 'Дата с']) ?? '').trim(),
    periodEnd: String(getByAliases(row, ['periodEnd', 'Конец периода', 'Дата по']) ?? '').trim(),
  };
}
