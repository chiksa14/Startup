// Основной JavaScript файл для QuranConnect
class QuranConnect {
    constructor() {
        this.userData = null;
        this.currentSurah = null;
        this.currentAyah = 1;
        this.audio = null;
        this.init();
    }

    async init() {
        // Инициализация приложения
        await this.loadUserData();
        this.initTheme();
        this.initEventListeners();
        await this.loadInitialData();
        this.hideLoader();
        this.setupPWA();
        
        // Анимация счетчиков
        this.animateCounters();
    }

    async loadUserData() {
        const savedData = localStorage.getItem('quranConnectData');
        
        if (savedData) {
            this.userData = JSON.parse(savedData);
        } else {
            // Создаем начальные данные
            this.userData = {
                settings: {
                    theme: 'auto',
                    location: {
                        city: 'Москва',
                        country: 'Россия',
                        latitude: 55.7558,
                        longitude: 37.6173
                    },
                    notifications: {
                        prayer: true,
                        dailyAyah: true
                    }
                },
                progress: {
                    streak: 0,
                    prayers: {
                        fajr: false, dhuhr: false, asr: false, maghrib: false, isha: false
                    },
                    quranPages: 0,
                    dhikrCount: 0,
                    lastActivity: new Date().toISOString().split('T')[0]
                },
                bookmarks: [],
                statistics: {
                    totalPrayers: 0,
                    totalPages: 0,
                    totalDhikr: 0,
                    longestStreak: 0
                }
            };
            
            this.saveUserData();
        }
    }

    saveUserData() {
        localStorage.setItem('quranConnectData', JSON.stringify(this.userData));
        
        // Обновляем статистику в реальном времени
        this.updateStats();
    }

    initTheme() {
        const savedTheme = this.userData.settings.theme;
        let theme = savedTheme;
        
        if (savedTheme === 'auto') {
            theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }
        
        document.documentElement.setAttribute('data-theme', theme);
    }

    initEventListeners() {
        // Навигация
        this.initNavigation();
        
        // Обработчики для чекбоксов намазов
        document.querySelectorAll('.prayer-checkbox input').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const prayer = e.target.closest('.prayer-time-card').dataset.prayer;
                this.updatePrayerStatus(prayer, e.target.checked);
            });
        });
        
        // Обработчики для ресайза
        window.addEventListener('resize', this.handleResize.bind(this));
        
        // Обработчики для PWA
        this.setupPWAEvents();
    }

    initNavigation() {
        // Плавная прокрутка для навигационных ссылок
        document.querySelectorAll('a[href^="#"]').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const target = document.querySelector(link.getAttribute('href'));
                if (target) {
                    const offsetTop = target.offsetTop - 80;
                    window.scrollTo({
                        top: offsetTop,
                        behavior: 'smooth'
                    });
                    
                    // Обновляем активную ссылку
                    this.updateActiveNavLink(link.getAttribute('href'));
                }
            });
        });
        
        // Обновление активной ссылки при скролле
        window.addEventListener('scroll', this.handleScroll.bind(this));
    }

    handleScroll() {
        const sections = document.querySelectorAll('section[id]');
        const scrollPos = window.scrollY + 100;
        
        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.offsetHeight;
            const sectionId = section.getAttribute('id');
            
            if (scrollPos >= sectionTop && scrollPos < sectionTop + sectionHeight) {
                this.updateActiveNavLink(`#${sectionId}`);
            }
        });
    }

    updateActiveNavLink(hash) {
        // Обновляем навигацию
        document.querySelectorAll('.nav-link, .mobile-nav-link').forEach(link => {
            link.classList.remove('active');
        });
        
        document.querySelectorAll(`[href="${hash}"]`).forEach(link => {
            link.classList.add('active');
        });
    }

    handleResize() {
        // Адаптивные обработчики
        if (window.innerWidth > 768) {
            this.closeMobileMenu();
        }
    }

    async loadInitialData() {
        // Загрузка списка сур
        await this.loadSuraList();
        
        // Загрузка времени намазов
        await this.updatePrayerTimes();
        
        // Загрузка даты Хиджры
        await this.updateHijriDate();
        
        // Загрузка закладок
        this.loadBookmarks();
        
        // Обновление прогресса
        this.updateProgress();
    }

    async loadSuraList() {
        try {
            // Используем локальные данные для сур
            const suras = [
                { number: 1, name: 'Al-Fatihah', arabic: 'الفاتحة', ayahs: 7, place: 'Meccan' },
                { number: 2, name: 'Al-Baqarah', arabic: 'البقرة', ayahs: 286, place: 'Medinan' },
                { number: 3, name: 'Al-Imran', arabic: 'آل عمران', ayahs: 200, place: 'Medinan' },
                { number: 4, name: 'An-Nisa', arabic: 'النساء', ayahs: 176, place: 'Medinan' },
                { number: 5, name: 'Al-Maidah', arabic: 'المائدة', ayahs: 120, place: 'Medinan' },
                // ... можно добавить остальные суры
            ];
            
            const suraList = document.getElementById('suraList');
            suraList.innerHTML = suras.map(sura => `
                <div class="sura-item" onclick="quranApp.selectSurah(${sura.number})">
                    <div class="sura-number">${sura.number}. ${sura.name}</div>
                    <div class="sura-name-arabic">${sura.arabic}</div>
                    <div class="sura-meta">${sura.ayahs} аятов • ${sura.place}</div>
                </div>
            `).join('');
            
        } catch (error) {
            console.error('Ошибка загрузки списка сур:', error);
            this.showNotification('Не удалось загрузить список сур', 'error');
        }
    }

    selectSurah(surahNumber) {
        this.currentSurah = surahNumber;
        this.currentAyah = 1;
        
        // Обновляем активный элемент
        document.querySelectorAll('.sura-item').forEach(item => {
            item.classList.remove('active');
        });
        
        event.target.closest('.sura-item').classList.add('active');
        
        // Загружаем первый аят суры
        this.loadAyah(surahNumber, 1);
        
        // Активируем кнопки навигации
        document.getElementById('prevBtn').disabled = false;
        document.getElementById('nextBtn').disabled = false;
    }

    async loadAyah(surah, ayah) {
        try {
            // В реальном приложении здесь будет API запрос
            // Для демо используем заглушки
            
            const demoAyahs = {
                1: {
                    1: {
                        arabic: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ',
                        translation: 'Во имя Аллаха, Милостивого, Милосердного',
                        transliteration: 'Bismillāhir-Raĥmānir-Raĥīm'
                    }
                }
            };
            
            const ayahData = demoAyahs[surah]?.[ayah] || {
                arabic: 'الآية غير متوفرة',
                translation: 'Аят временно недоступен',
                transliteration: 'Ayah temporarily unavailable'
            };
            
            // Обновляем интерфейс
            document.getElementById('arabicText').textContent = ayahData.arabic;
            document.getElementById('translationText').textContent = ayahData.translation;
            document.getElementById('transliterationText').textContent = ayahData.transliteration;
            document.getElementById('ayahReference').textContent = `${surah}:${ayah}`;
            document.getElementById('currentSuraName').textContent = `Сура ${this.getSurahName(surah)}`;
            document.getElementById('ayahCounter').textContent = `Аят ${ayah} из ${this.getSurahAyahs(surah)}`;
            
            // Обновляем состояние кнопок навигации
            document.getElementById('prevBtn').disabled = ayah <= 1;
            document.getElementById('nextBtn').disabled = ayah >= this.getSurahAyahs(surah);
            
        } catch (error) {
            console.error('Ошибка загрузки аята:', error);
            this.showNotification('Не удалось загрузить аят', 'error');
        }
    }

    getSurahName(surahNumber) {
        const surahNames = {
            1: 'Аль-Фатиха',
            2: 'Аль-Бакара',
            3: 'Аль-Имран',
            4: 'Ан-Ниса',
            5: 'Аль-Маида'
        };
        return surahNames[surahNumber] || `Сура ${surahNumber}`;
    }

    getSurahAyahs(surahNumber) {
        const surahAyahs = {
            1: 7,
            2: 286,
            3: 200,
            4: 176,
            5: 120
        };
        return surahAyahs[surahNumber] || 1;
    }

    async updatePrayerTimes() {
        try {
            const { city } = this.userData.settings.location;
            
            // В реальном приложении здесь будет API запрос
            // Для демо используем статические данные
            const prayerTimes = {
                fajr: '05:30',
                dhuhr: '13:00',
                asr: '16:30',
                maghrib: '19:15',
                isha: '21:00'
            };
            
            // Обновляем интерфейс
            Object.entries(prayerTimes).forEach(([prayer, time]) => {
                const element = document.getElementById(`${prayer}Time`);
                if (element) {
                    element.textContent = time;
                }
            });
            
            // Обновляем информацию о местоположении
            document.getElementById('locationInfo').textContent = 
                `Текущее местоположение: ${city}, ${this.userData.settings.location.country}`;
                
            // Обновляем следующий намаз
            this.updateNextPrayer(prayerTimes);
            
        } catch (error) {
            console.error('Ошибка загрузки времени намазов:', error);
            this.showNotification('Не удалось загрузить время намазов', 'error');
        }
    }

    updateNextPrayer(timings) {
        const now = new Date();
        const currentTime = now.getHours() * 60 + now.getMinutes();
        
        const prayers = [
            { name: 'Фаджр', time: this.timeToMinutes(timings.fajr) },
            { name: 'Зухр', time: this.timeToMinutes(timings.dhuhr) },
            { name: 'Аср', time: this.timeToMinutes(timings.asr) },
            { name: 'Магриб', time: this.timeToMinutes(timings.maghrib) },
            { name: 'Иша', time: this.timeToMinutes(timings.isha) }
        ];
        
        let nextPrayer = null;
        for (const prayer of prayers) {
            if (prayer.time > currentTime) {
                nextPrayer = prayer;
                break;
            }
        }
        
        // Если следующий намаз не найден, берем первый намаз следующего дня
        if (!nextPrayer) {
            nextPrayer = prayers[0];
            nextPrayer.time += 24 * 60;
        }
        
        this.displayNextPrayer(nextPrayer, currentTime);
    }

    timeToMinutes(timeStr) {
        const [hours, minutes] = timeStr.split(':');
        return parseInt(hours) * 60 + parseInt(minutes);
    }

    displayNextPrayer(prayer, currentTime) {
        const timeDiff = prayer.time - currentTime;
        const hours = Math.floor(timeDiff / 60);
        const minutes = timeDiff % 60;
        
        document.getElementById('nextPrayerName').textContent = prayer.name;
        document.getElementById('nextPrayerTime').textContent = 
            this.minutesToTime(prayer.time);
        document.getElementById('prayerCountdown').textContent = 
            `через ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    }

    minutesToTime(minutes) {
        const hours = Math.floor(minutes / 60) % 24;
        const mins = minutes % 60;
        return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
    }

    async updateHijriDate() {
        try {
            const today = new Date();
            // Упрощенный расчет даты Хиджры
            const hijriDate = this.gregorianToHijri(today);
            
            document.getElementById('hijriDay').textContent = hijriDate.day;
            document.getElementById('hijriMonth').textContent = hijriDate.monthName;
            document.getElementById('hijriYear').textContent = `${hijriDate.year} г.х.`;
            document.getElementById('gregorianDate').textContent = 
                today.toLocaleDateString('ru-RU', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric',
                    weekday: 'long'
                });
                
        } catch (error) {
            console.error('Ошибка загрузки даты Хиджры:', error);
        }
    }

    gregorianToHijri(date) {
        // Упрощенный расчет (в реальном приложении использовать библиотеку)
        const hijriMonths = [
            'Мухаррам', 'Сафар', 'Раби аль-авваль', 'Раби ас-сани', 
            'Джумада аль-уля', 'Джумада ас-сания', 'Раджаб', 'Шаабан', 
            'Рамадан', 'Шавваль', 'Зуль-каада', 'Зуль-хиджа'
        ];
        
        return {
            day: 15,
            month: 8,
            year: 1445,
            monthName: hijriMonths[7] // Шаабан
        };
    }

    updatePrayerStatus(prayer, completed) {
        this.userData.progress.prayers[prayer] = completed;
        
        if (completed) {
            this.userData.statistics.totalPrayers++;
        }
        
        this.saveUserData();
        this.updateProgress();
        
        if (completed) {
            this.showNotification(`Намаз ${this.getPrayerName(prayer)} отмечен как выполненный!`);
        }
    }

    getPrayerName(prayer) {
        const names = {
            fajr: 'Фаджр',
            dhuhr: 'Зухр',
            asr: 'Аср',
            maghrib: 'Магриб',
            isha: 'Иша'
        };
        return names[prayer];
    }

    updateProgress() {
        // Обновляем статистику
        const completedPrayers = Object.values(this.userData.progress.prayers).filter(Boolean).length;
        const totalPrayers = Object.keys(this.userData.progress.prayers).length;
        
        document.getElementById('currentStreak').textContent = this.userData.progress.streak;
        document.getElementById('weeklyPrayers').textContent = completedPrayers;
        document.getElementById('quranProgress').textContent = this.userData.progress.quranPages;
        
        document.getElementById('prayerScore').textContent = `${completedPrayers}/${totalPrayers}`;
        document.getElementById('quranScore').textContent = `${this.userData.progress.quranPages}/10`;
        document.getElementById('dhikrScore').textContent = `${this.userData.progress.dhikrCount}/100`;
        
        // Обновляем прогресс-бары
        document.getElementById('prayerProgress').style.width = `${(completedPrayers / totalPrayers) * 100}%`;
        document.getElementById('quranProgressBar').style.width = `${(this.userData.progress.quranPages / 10) * 100}%`;
        document.getElementById('dhikrProgress').style.width = `${(this.userData.progress.dhikrCount / 100) * 100}%`;
        
        document.getElementById('dhikrCount').textContent = this.userData.progress.dhikrCount;
    }

    loadBookmarks() {
        const bookmarksList = document.getElementById('bookmarksList');
        
        if (this.userData.bookmarks.length === 0) {
            bookmarksList.innerHTML = `
                <div class="empty-state">
                    <i class="far fa-bookmark"></i>
                    <p>У вас пока нет закладок</p>
                </div>
            `;
            return;
        }
        
        bookmarksList.innerHTML = this.userData.bookmarks.map(bookmark => `
            <div class="bookmark-item">
                <div class="bookmark-arabic">${bookmark.arabic}</div>
                <div class="bookmark-translation">${bookmark.translation}</div>
                <div class="bookmark-meta">
                    <span>${bookmark.reference}</span>
                    <div class="bookmark-actions">
                        <button class="btn-bookmark-action" onclick="quranApp.goToBookmark(${bookmark.surah}, ${bookmark.ayah})">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn-bookmark-action" onclick="quranApp.removeBookmark('${bookmark.id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    toggleBookmark() {
        if (!this.currentSurah) return;
        
        const bookmark = {
            id: `${this.currentSurah}-${this.currentAyah}`,
            surah: this.currentSurah,
            ayah: this.currentAyah,
            arabic: document.getElementById('arabicText').textContent,
            translation: document.getElementById('translationText').textContent,
            reference: `${this.currentSurah}:${this.currentAyah}`
        };
        
        const existingIndex = this.userData.bookmarks.findIndex(b => b.id === bookmark.id);
        
        if (existingIndex > -1) {
            this.userData.bookmarks.splice(existingIndex, 1);
            this.showNotification('Закладка удалена');
        } else {
            this.userData.bookmarks.push(bookmark);
            this.showNotification('Аят добавлен в закладки');
        }
        
        this.saveUserData();
        this.loadBookmarks();
        
        // Обновляем иконку закладки
        const bookmarkBtn = document.getElementById('bookmarkBtn');
        const icon = bookmarkBtn.querySelector('i');
        
        if (existingIndex > -1) {
            icon.classList.remove('fas');
            icon.classList.add('far');
        } else {
            icon.classList.remove('far');
            icon.classList.add('fas');
        }
    }

    async playAyahAudio() {
        try {
            if (!this.currentSurah) return;
            
            // В реальном приложении здесь будет воспроизведение аудио
            // Для демо показываем уведомление
            this.showNotification('Воспроизведение аудио...');
            
        } catch (error) {
            console.error('Ошибка воспроизведения аудио:', error);
            this.showNotification('Не удалось воспроизвести аудио', 'error');
        }
    }

    shareAyah() {
        const arabic = document.getElementById('arabicText').textContent;
        const translation = document.getElementById('translationText').textContent;
        const reference = document.getElementById('ayahReference').textContent;
        
        const shareText = `${arabic}\n\n${translation}\n\n${reference}\n\nПоделено через QuranConnect`;
        
        if (navigator.share) {
            navigator.share({
                title: 'Аят из Корана',
                text: shareText
            });
        } else {
            // Fallback для браузеров без поддержки Web Share API
            navigator.clipboard.writeText(shareText);
            this.showNotification('Аят скопирован в буфер обмена');
        }
    }

    copyAyahText() {
        const arabic = document.getElementById('arabicText').textContent;
        const translation = document.getElementById('translationText').textContent;
        const reference = document.getElementById('ayahReference').textContent;
        
        const text = `${arabic}\n\n${translation}\n\n${reference}`;
        navigator.clipboard.writeText(text);
        this.showNotification('Текст аята скопирован');
    }

    updateStats() {
        // Обновляем счетчики на главной
        document.getElementById('usersCount').textContent = '1,247';
        document.getElementById('ayahsRead').textContent = '45,892';
        document.getElementById('prayersTracked').textContent = '89,456';
    }

    animateCounters() {
        const counters = document.querySelectorAll('.stat-number');
        
        counters.forEach(counter => {
            const target = parseInt(counter.textContent.replace(/,/g, ''));
            const duration = 2000;
            const step = target / (duration / 16);
            let current = 0;
            
            const timer = setInterval(() => {
                current += step;
                if (current >= target) {
                    counter.textContent = target.toLocaleString();
                    clearInterval(timer);
                } else {
                    counter.textContent = Math.floor(current).toLocaleString();
                }
            }, 16);
        });
    }

    hideLoader() {
        const loader = document.getElementById('loader');
        setTimeout(() => {
            loader.style.opacity = '0';
            setTimeout(() => {
                loader.style.display = 'none';
            }, 500);
        }, 1000);
    }

    showNotification(message, type = 'success') {
        const notification = document.getElementById('notification');
        const messageElement = document.getElementById('notificationMessage');
        
        messageElement.textContent = message;
        notification.className = `notification show ${type}`;
        
        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }

    setupPWA() {
        // Регистрация Service Worker уже в HTML
        this.setupPWAEvents();
    }

    setupPWAEvents() {
        let deferredPrompt;
        
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
            
            // Показываем предложение об установке
            setTimeout(() => {
                this.showInstallPrompt();
            }, 5000);
        });
        
        // Обработчик установки
        document.getElementById('installButton').addEventListener('click', async () => {
            if (deferredPrompt) {
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                
                if (outcome === 'accepted') {
                    this.showNotification('Приложение успешно установлено!');
                }
                
                deferredPrompt = null;
                this.hideInstallPrompt();
            }
        });
        
        document.getElementById('dismissInstall').addEventListener('click', () => {
            this.hideInstallPrompt();
        });
    }

    showInstallPrompt() {
        const prompt = document.getElementById('installPrompt');
        prompt.classList.remove('hidden');
    }

    hideInstallPrompt() {
        const prompt = document.getElementById('installPrompt');
        prompt.classList.add('hidden');
    }

    // Методы для глобального доступа
    nextAyah() {
        if (this.currentSurah && this.currentAyah < this.getSurahAyahs(this.currentSurah)) {
            this.currentAyah++;
            this.loadAyah(this.currentSurah, this.currentAyah);
        }
    }

    previousAyah() {
        if (this.currentSurah && this.currentAyah > 1) {
            this.currentAyah--;
            this.loadAyah(this.currentSurah, this.currentAyah);
        }
    }

    incrementQuranPages(pages) {
        this.userData.progress.quranPages += pages;
        this.userData.statistics.totalPages += pages;
        this.saveUserData();
        this.showNotification(`Добавлено ${pages} страниц Корана`);
    }

    incrementDhikr(count) {
        this.userData.progress.dhikrCount = Math.max(0, this.userData.progress.dhikrCount + count);
        this.userData.statistics.totalDhikr += count;
        this.saveUserData();
    }
}

// Глобальные функции
function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    
    // Сохраняем настройку
    if (window.quranApp) {
        window.quranApp.userData.settings.theme = newTheme;
        window.quranApp.saveUserData();
    }
}

function toggleMobileMenu() {
    const menu = document.getElementById('mobileMenu');
    menu.classList.toggle('open');
}

function closeMobileMenu() {
    const menu = document.getElementById('mobileMenu');
    menu.classList.remove('open');
}

function scrollToSection(sectionId) {
    const section = document.querySelector(sectionId);
    if (section) {
        const offsetTop = section.offsetTop - 80;
        window.scrollTo({
            top: offsetTop,
            behavior: 'smooth'
        });
    }
}

function showAuthModal() {
    document.getElementById('authModal').classList.add('show');
}

function showDonateModal() {
    document.getElementById('donateModal').classList.add('show');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('show');
}

function hideNotification() {
    document.getElementById('notification').classList.remove('show');
}

function searchSuras() {
    const searchTerm = document.getElementById('suraSearch').value.toLowerCase();
    const suraItems = document.querySelectorAll('.sura-item');
    
    suraItems.forEach(item => {
        const text = item.textContent.toLowerCase();
        if (text.includes(searchTerm)) {
            item.style.display = 'block';
        } else {
            item.style.display = 'none';
        }
    });
}

function updateQiblaDirection() {
    if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                calculateQiblaDirection(latitude, longitude);
            },
            (error) => {
                console.error('Ошибка геолокации:', error);
                window.quranApp.showNotification('Не удалось определить местоположение', 'error');
            }
        );
    } else {
        window.quranApp.showNotification('Геолокация не поддерживается вашим браузером', 'error');
    }
}

function calculateQiblaDirection(lat, lng) {
    // Упрощенный расчет направления Киблы
    // В реальном приложении использовать точные формулы
    
    const arrow = document.getElementById('qiblaArrow');
    const direction = document.getElementById('qiblaDirection');
    const degree = document.getElementById('qiblaDegree');
    
    // Заглушка для демо
    const qiblaDirection = 135; // Юго-Восток
    arrow.style.transform = `rotate(${qiblaDirection}deg)`;
    direction.textContent = 'Юго-Восток';
    degree.textContent = `${qiblaDirection}°`;
    
    window.quranApp.showNotification('Направление Киблы обновлено');
}

function selectDonateAmount(amount) {
    if (amount === 0) {
        document.getElementById('customAmount').classList.remove('hidden');
    } else {
        document.getElementById('customAmount').classList.add('hidden');
        window.quranApp.showNotification(`Выбрана сумма: ${amount} ₽`);
    }
}

function processDonation(method) {
    window.quranApp.showNotification(`Перенаправление на страницу оплаты через ${method}...`);
    // В реальном приложении здесь будет редирект на платежную систему
}

// Инициализация приложения
document.addEventListener('DOMContentLoaded', () => {
    window.quranApp = new QuranConnect();
});

// Предотвращение контекстного меню на изображениях
document.addEventListener('contextmenu', (e) => {
    if (e.target.tagName === 'IMG') {
        e.preventDefault();
    }
});

// Обработка ошибок
window.addEventListener('error', (e) => {
    console.error('Global error:', e.error);
});