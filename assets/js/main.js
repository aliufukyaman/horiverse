// Horiverse - Mobil Oyun Şirketi JavaScript

// Sayfa yüklendiğinde çalışacak fonksiyonlar
document.addEventListener('DOMContentLoaded', function() {
  // Animasyonlu scroll
  const scrollLinks = document.querySelectorAll('.scroll-link');
  
  scrollLinks.forEach(link => {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      
      const targetId = this.getAttribute('href').substring(1);
      const targetElement = document.getElementById(targetId);
      
      window.scrollTo({
        top: targetElement.offsetTop - 70,
        behavior: 'smooth'
      });
    });
  });
  
  // Scroll olduğunda header'ın stilini değiştir
  window.addEventListener('scroll', function() {
    const header = document.querySelector('.header');
    
    if (window.scrollY > 100) {
      header.style.background = 'linear-gradient(135deg, var(--primary-color), rgb(220, 161, 104))';
      header.style.padding = '15px 0';
    } else {
      header.style.background = 'linear-gradient(135deg, var(--primary-color), rgb(220, 161, 104))';
      header.style.padding = '20px 0';
    }
  });
  
  // Oyun kartlarına hover efekti
  const gameCards = document.querySelectorAll('.game-card');
  
  gameCards.forEach(card => {
    card.addEventListener('mouseenter', function() {
      this.style.transform = 'translateY(-10px)';
    });
    
    card.addEventListener('mouseleave', function() {
      this.style.transform = 'translateY(0)';
    });
  });
});