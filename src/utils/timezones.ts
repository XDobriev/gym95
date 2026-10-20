export interface TzOption {
  iana: string;
  label: string; // «МСК+2»
  city: string;
}

export const RU_TIMEZONES: TzOption[] = [
  { iana: 'Europe/Moscow', label: 'МСК', city: 'Москва' },
  { iana: 'Europe/Kaliningrad', label: 'МСК−1', city: 'Калининград' },
  { iana: 'Europe/Samara', label: 'МСК+1', city: 'Самара' },
  { iana: 'Asia/Yekaterinburg', label: 'МСК+2', city: 'Екатеринбург' },
  { iana: 'Asia/Omsk', label: 'МСК+3', city: 'Омск' },
  { iana: 'Asia/Krasnoyarsk', label: 'МСК+4', city: 'Красноярск' },
  { iana: 'Asia/Irkutsk', label: 'МСК+5', city: 'Иркутск' },
  { iana: 'Asia/Yakutsk', label: 'МСК+6', city: 'Якутск' },
  { iana: 'Asia/Vladivostok', label: 'МСК+7', city: 'Владивосток' },
  { iana: 'Asia/Magadan', label: 'МСК+8', city: 'Магадан' },
  { iana: 'Asia/Kamchatka', label: 'МСК+9', city: 'Камчатка' },
];

export function isKnownTimezone(iana: string): boolean {
  return RU_TIMEZONES.some((t) => t.iana === iana);
}

export function tzLabel(iana: string): string {
  const t = RU_TIMEZONES.find((x) => x.iana === iana);
  return t ? `${t.label} (${t.city})` : iana;
}
