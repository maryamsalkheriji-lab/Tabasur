export const registrationStatus = {
  ar: 'التسجيل الحضوري مغلق · التسجيل متاح للأونلاين فقط',
  en: 'In-person registration is closed · Online registration only',
}

// الرعاة المؤكدون: { name, logo, ratio } — ratio = عرض الشعار ÷ ارتفاعه بعد قصّ الحواف،
// ويُستخدم لموازنة الحجم البصري حتى تظهر كل الشعارات بنفس الثقل.
export const sponsors = [
  { name: 'كرك أسرع — Karak Express', logo: '/assets/sponsors/karak.png', ratio: 0.72 },
  { name: 'Tahcom AI', logo: '/assets/sponsors/tahcom-ai.png', ratio: 1.61 },
  { name: 'سوتس — Suits', logo: '/assets/sponsors/suits.png', ratio: 2.73 },
  { name: 'المدينة — Madinah', logo: '/assets/sponsors/madinah.png', ratio: 0.58 },
  { name: 'زوايا مبتكرة — Zwaya Mubtakara', logo: '/assets/sponsors/zwaya.png', ratio: 2.79 },
  { name: 'my', logo: '/assets/sponsors/my.png', ratio: 0.94 },
  { name: 'العنان للسفر — Alanan Travel', logo: '/assets/sponsors/alanan.png', ratio: 3.01 },
  { name: 'أثر المدينة — Athar Almadinah', logo: '/assets/sponsors/athar.png', ratio: 0.96 },
  { name: 'م إ ش للتصميم المعماري — MISH Architecture', logo: '/assets/sponsors/mish.png', ratio: 3.77 },
  { name: 'مصنع هدية المدينة — Madinah Gift Factory', logo: '/assets/sponsors/madinah-gift-factory.png', ratio: 2.0 },
  { name: 'لوفيس لحلول الأعمال — Luves Business Solutions', logo: '/assets/sponsors/luves.png', ratio: 1.16 },
  { name: 'Zero', logo: '/assets/sponsors/zero.png', ratio: 3.15 },
]
