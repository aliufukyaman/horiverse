// Horiverse - Main JS

// ── I18N ──────────────────────────────────────────────
const TRANSLATIONS = {
  en: {
    hero_title:    'Welcome to the Horiverse',
    hero_sub:      'Creating innovative and engaging mobile games that bring joy to millions of players worldwide.',
    games_title:   'Our Games',
    nav_home:      'Home',
    nav_games:     'Games',
    nav_about:     'About',
    nav_contact:   'Contact',
    horiku_desc:   'A challenging puzzle game that tests your logic and strategic thinking. Discover hidden paths, solve tricky levels, and master every challenge!',
    horiball_desc: 'An exciting new adventure is on the way. Stay tuned for updates!',
    under_dev:     'Under Development',
    about_title:   'About Horiverse',
    about_p1:      'Horiverse is an innovative mobile game studio founded in 2025. Our mission is to create fun, engaging, and addictive gaming experiences for players around the world.',
    about_p2:      'Our team consists of passionate and experienced game development professionals. We strive for the highest quality and user satisfaction in every project we undertake.',
    about_p3:      'From puzzle games to action-packed adventures, we\'re dedicated to bringing fresh ideas and memorable experiences to the mobile gaming landscape.',
    contact_title: 'Contact Us',
    contact_sub:   'Have questions? We\'d love to hear from you!',
    get_in_touch:  'Get In Touch',
    contact_p1:    'Send us an email or follow us on social media to stay updated with our latest games and news.',
    footer_copy:   '© 2026 Horiverse. All rights reserved.',
  },
  tr: {
    hero_title:    'Horiverse\'e Hoş Geldiniz',
    hero_sub:      'Dünya genelinde milyonlarca oyuncuya keyif sunan yenilikçi mobil oyunlar geliştiriyoruz.',
    games_title:   'Oyunlarımız',
    nav_home:      'Ana Sayfa',
    nav_games:     'Oyunlar',
    nav_about:     'Hakkımızda',
    nav_contact:   'İletişim',
    horiku_desc:   'Mantık ve stratejik düşüncenizi test eden zorlu bir bulmaca oyunu. Gizli yolları keşfedin, zor seviyeleri çözün ve her meydan okumada ustalaşın!',
    horiball_desc: 'Heyecan verici yeni bir macera yolda. Güncellemeler için takipte kalın!',
    under_dev:     'Geliştiriliyor',
    about_title:   'Horiverse Hakkında',
    about_p1:      'Horiverse, 2025 yılında kurulan yenilikçi bir mobil oyun stüdyosudur. Misyonumuz; dünyanın dört bir yanındaki oyuncular için eğlenceli ve bağımlılık yapan oyun deneyimleri yaratmaktır.',
    about_p2:      'Ekibimiz, tutkulu ve deneyimli oyun geliştirme profesyonellerinden oluşmaktadır. Her projede en yüksek kaliteyi ve kullanıcı memnuniyetini hedefliyoruz.',
    about_p3:      'Bulmaca oyunlarından aksiyon dolu maceralara kadar, mobil oyun dünyasına taze fikirler ve unutulmaz deneyimler katmaya kararlıyız.',
    contact_title: 'İletişime Geçin',
    contact_sub:   'Sorularınız mı var? Sizden haber almak isteriz!',
    get_in_touch:  'Bize Ulaşın',
    contact_p1:    'En son oyunlarımız ve haberlerimizden haberdar olmak için bize e-posta gönderin veya sosyal medyada takip edin.',
    footer_copy:   '© 2026 Horiverse. Tüm hakları saklıdır.',
  }
};

let currentLang = localStorage.getItem('hori_lang') || 'en';

function applyLang(lang) {
  currentLang = lang;
  localStorage.setItem('hori_lang', lang);
  const t = TRANSLATIONS[lang] || TRANSLATIONS.en;
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (t[key] !== undefined) el.textContent = t[key];
  });
  // update active lang display
  document.querySelectorAll('.current-lang').forEach(el => el.textContent = lang.toUpperCase());
}

// ── INIT ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
  // Smooth scroll
  document.querySelectorAll('.scroll-link').forEach(link => {
    link.addEventListener('click', function(e) {
      const href = this.getAttribute('href');
      if (!href || href === '#') return;
      const targetId = href.substring(1);
      const targetElement = document.getElementById(targetId);
      if (!targetElement) return;
      e.preventDefault();
      window.scrollTo({ top: targetElement.offsetTop - 70, behavior: 'smooth' });
    });
  });

  // Language switcher
  document.querySelectorAll('.lang-option').forEach(el => {
    el.addEventListener('click', function(e) {
      e.preventDefault();
      applyLang(this.getAttribute('data-lang'));
    });
  });

  // Apply saved lang on load
  applyLang(currentLang);
});