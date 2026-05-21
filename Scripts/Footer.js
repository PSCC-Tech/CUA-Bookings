(function () {
    const footerHtml = `
        <div class="footer-inner">
            <div class="footer-brand footer-brand-small" aria-label="Inter Aguadilla logo">
                <img
                    class="footer-logo footer-logo-small"
                    src="Images/InterAguadillaLogo.jpg"
                    alt="Inter Aguadilla"
                    loading="lazy"
                >
                <span class="footer-small-logo-text">
                    <span>Inter American University</span>
                    <span>of Puerto Rico, Inc.</span>
                    <span>Aguadilla Campus</span>
                </span>
            </div>

            <div class="footer-contact" aria-label="Contact information for Centro Universitario de Aprendizaje">
                <div class="footer-contact-card">
                    <p class="footer-contact-intro">For more information or to schedule your appointment, please contact</p>
                    <p class="footer-contact-main"><strong>Centro Universitario de Aprendizaje:</strong> <a href="tel:+17878910925">787-891-0925</a></p>
                    <ul class="footer-contact-list">
                        <li><span class="footer-contact-number">Ext. 2256 or <a href="tel:+17879310729">(787) 931-0729</a></span><span class="footer-contact-service">CUA Mentorship Coordinator</span></li>
                        <li><span class="footer-contact-number">Ext. 2259 or <a href="tel:+17879310730">(787) 931-0730</a></span><span class="footer-contact-service">Mathematics, Spanish, and Sciences Laboratory</span></li>
                        <li><span class="footer-contact-number">Ext. 2261 or <a href="tel:+17879310732">(787) 931-0732</a></span><span class="footer-contact-service">English Laboratory</span></li>
                        <li><span class="footer-contact-number">Ext. 2182 or <a href="tel:+17879310629">(787) 931-0629</a></span><span class="footer-contact-service">CUA Administrative Assistant</span></li>
                    </ul>
                </div>
            </div>

            <div class="footer-brand footer-brand-full" aria-label="Universidad Interamericana de Puerto Rico, Recinto de Aguadilla">
                <img
                    class="footer-logo footer-logo-full"
                    src="Images/InterAguadillaFullLogo.png"
                    alt="Universidad Interamericana de Puerto Rico, Recinto de Aguadilla"
                    loading="lazy"
                >
            </div>
        </div>
    `;

    function ensureFooter() {
        let footers = Array.from(document.querySelectorAll(".footer"));

        if (footers.length === 0) {
            const mainContent = document.querySelector("main.content");
            if (!mainContent) return;

            const footer = document.createElement("footer");
            footer.className = "footer";
            mainContent.appendChild(footer);
            footers = [footer];
        }

        footers.forEach(footer => {
            footer.classList.toggle("footer-compact", !document.body.classList.contains("login-page"));
            footer.innerHTML = footerHtml;
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", ensureFooter);
    } else {
        ensureFooter();
    }
})();
