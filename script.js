
const btnAndroid = document.getElementById('btn-android');
const btnIos = document.getElementById('btn-ios');
const qrCardInner = document.getElementById('qr-card-inner');


btnIos.addEventListener('click', () => {
    btnAndroid.classList.remove('active');
    btnIos.classList.add('active');
    qrCardInner.classList.add('flipped');
});


btnAndroid.addEventListener('click', () => {
    btnIos.classList.remove('active'); 
    btnAndroid.classList.add('active');
    qrCardInner.classList.remove('flipped');
});
// Scroll to Top logic
const scrollTopBtn = document.getElementById('scrollTopBtn');

if (scrollTopBtn) {
    window.addEventListener('scroll', () => {
        if (window.scrollY > 300) {
            scrollTopBtn.classList.add('show');
        } else {
            scrollTopBtn.classList.remove('show');
        }
    });

    scrollTopBtn.addEventListener('click', () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
}