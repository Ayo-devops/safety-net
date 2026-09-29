(() => {
  const pathPart = window.location.pathname.split('/').pop();
  const currentPage = pathPart && !pathPart.includes('.') ? `${pathPart}.html` : pathPart || 'index.html';
  const navLinks = document.querySelector('.nav-links');
  const mobilePanel = document.getElementById('navPanel');
  const navCta = document.querySelector('.nav-cta');
  if (!navLinks || !mobilePanel || !navCta) return;

  const current = page => currentPage === page ? ' aria-current="page"' : '';
  const groupClass = pages => pages.includes(currentPage) ? ' current-group' : '';
  const servicePages = ['free-services.html', 'premium-services.html'];
  const supportPages = ['get-support.html', 'support-chat.html', 'access-jesus.html'];

  navLinks.innerHTML = `
    <li class="nav-dropdown${groupClass(servicePages)}">
      <button class="nav-dropdown-toggle" type="button" aria-expanded="false">Services <span class="nav-chevron" aria-hidden="true"></span></button>
      <div class="nav-dropdown-menu">
        <a href="free-services.html"${current('free-services.html')}><span>Free Services</span><small>Food, skills and empowerment</small></a>
        <a href="premium-services.html"${current('premium-services.html')}><span>Professional Services</span><small>Therapy and specialist support</small></a>
      </div>
    </li>
    <li class="nav-dropdown${groupClass(supportPages)}">
      <button class="nav-dropdown-toggle" type="button" aria-expanded="false">Get Support <span class="nav-chevron" aria-hidden="true"></span></button>
      <div class="nav-dropdown-menu">
        <a href="get-support.html"${current('get-support.html')}><span>Support Overview</span><small>Find the right pathway</small></a>
        <a href="support-chat.html"${current('support-chat.html')}><span>Talk to a Listener</span><small>Website chat and guidance</small></a>
        <a href="access-jesus.html"${current('access-jesus.html')}><span>Access Jesus</span><small>Optional faith resources</small></a>
      </div>
    </li>
    <li><a href="give-partner.html"${current('give-partner.html')}>Support &amp; Partner</a></li>
    <li><a href="about.html"${current('about.html')}>About</a></li>
    <li><a href="contact.html"${current('contact.html')}>Contact</a></li>`;

  navCta.textContent = 'Start Here';
  navCta.setAttribute('href', 'get-support.html');
  if (currentPage === 'get-support.html') navCta.setAttribute('aria-current', 'page');
  else navCta.removeAttribute('aria-current');

  mobilePanel.innerHTML = `
    <a href="index.html"${current('index.html')}>Home</a>
    <details class="nav-mobile-group${groupClass(servicePages)}"${servicePages.includes(currentPage) ? ' open' : ''}>
      <summary>Services <span class="nav-chevron" aria-hidden="true"></span></summary>
      <div class="nav-mobile-submenu">
        <a href="free-services.html"${current('free-services.html')}>Free Services</a>
        <a href="premium-services.html"${current('premium-services.html')}>Professional Services</a>
      </div>
    </details>
    <details class="nav-mobile-group${groupClass(supportPages)}"${supportPages.includes(currentPage) ? ' open' : ''}>
      <summary>Get Support <span class="nav-chevron" aria-hidden="true"></span></summary>
      <div class="nav-mobile-submenu">
        <a href="get-support.html"${current('get-support.html')}>Support Overview</a>
        <a href="support-chat.html"${current('support-chat.html')}>Talk to a Listener</a>
        <a href="access-jesus.html"${current('access-jesus.html')}>Access Jesus</a>
      </div>
    </details>
    <a href="give-partner.html"${current('give-partner.html')}>Support &amp; Partner</a>
    <a href="about.html"${current('about.html')}>About</a>
    <a href="contact.html"${current('contact.html')}>Contact</a>`;

  const dropdowns = [...navLinks.querySelectorAll('.nav-dropdown')];
  const closeDropdown = dropdown => {
    dropdown.classList.remove('open');
    dropdown.querySelector('.nav-dropdown-toggle').setAttribute('aria-expanded', 'false');
  };
  const openDropdown = dropdown => {
    dropdowns.forEach(otherDropdown => {
      if (otherDropdown !== dropdown) closeDropdown(otherDropdown);
    });
    dropdown.classList.add('open');
    dropdown.querySelector('.nav-dropdown-toggle').setAttribute('aria-expanded', 'true');
  };
  dropdowns.forEach(dropdown => {
    const toggle = dropdown.querySelector('.nav-dropdown-toggle');
    toggle.addEventListener('click', () => {
      const willOpen = !dropdown.classList.contains('open');
      dropdowns.forEach(closeDropdown);
      if (willOpen) openDropdown(dropdown);
    });
    dropdown.addEventListener('mouseenter', () => {
      if (window.matchMedia('(min-width: 1201px)').matches) openDropdown(dropdown);
    });
    dropdown.addEventListener('mouseleave', () => {
      if (window.matchMedia('(min-width: 1201px)').matches) closeDropdown(dropdown);
    });
  });
  document.addEventListener('click', event => {
    if (!event.target.closest('.nav-dropdown')) dropdowns.forEach(closeDropdown);
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    const openDropdown = navLinks.querySelector('.nav-dropdown.open');
    if (!openDropdown) return;
    const toggle = openDropdown.querySelector('.nav-dropdown-toggle');
    closeDropdown(openDropdown);
    toggle.focus();
  });
})();
