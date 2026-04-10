// --- Configuration ---
const CONFIG = {
    INTRO_DURATION: 3000,
    FEEDS: [
        'https://feeds.feedburner.com/TheHackersNews',
        'https://www.bleepingcomputer.com/feed/',
        'https://www.darkreading.com/rss.xml',
        'https://krebsonsecurity.com/feed/'
    ],
    RSS_CONVERTER: 'https://api.rss2json.com/v1/api.json?rss_url='
};

// --- APP STATE ---
const state = {
    news: [],
    wishlist: JSON.parse(localStorage.getItem('cyber_wishlist') || '[]'),
    currentFilter: 'all',
    currentLevel: 'all',
    currentTab: 'live', // 'live' or 'saved'
    searchQuery: '',
    introComplete: false,
    loading: true
};

// --- CORE LOGIC ---

async function fetchRealNews() {
    state.loading = true;
    updateStatus('DECRYPTING...', '--:--');

    try {
        const fetchPromises = CONFIG.FEEDS.map(url =>
            fetch(CONFIG.RSS_CONVERTER + encodeURIComponent(url)).then(res => res.json())
        );

        const results = await Promise.all(fetchPromises);
        let allItems = [];

        results.forEach(data => {
            if (data.status === 'ok') {
                const items = data.items.map(item => {
                    const fullText = (item.title + ' ' + item.description).toLowerCase();
                    const country = detectCountry(fullText);
                    return {
                        id: btoa(item.link).substring(0, 16), // Simple unique ID
                        title: item.title,
                        description: cleanDescription(item.description),
                        source: data.feed.title || 'UNKNOWN INTEL',
                        time: formatTime(item.pubDate),
                        rawDate: new Date(item.pubDate),
                        severity: classifySeverity(fullText),
                        image: item.thumbnail || item.enclosure?.link || getRandomCyberImage(),
                        link: item.link,
                        country: country,
                        level: detectLevel(fullText, country)
                    };
                });
                allItems = [...allItems, ...items];
            }
        });

        // Sort by date (latest first)
        state.news = allItems.sort((a, b) => b.rawDate - a.rawDate);
        state.displayNews = [...state.news];
        state.loading = false;

        renderNews();
        updateMetadata();
    } catch (error) {
        console.error("Uplink Failure:", error);
        state.loading = false;
        renderNews();
    }
}

function cleanDescription(html) {
    const div = document.createElement('div');
    div.innerHTML = html;
    let text = div.textContent || div.innerText || "";
    return text.length > 150 ? text.substring(0, 150) + '...' : text;
}

function formatTime(dateStr) {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now - date) / (1000 * 60)); // minutes

    if (diff < 60) return `${diff}M AGO`;
    if (diff < 1440) return `${Math.floor(diff / 60)}H AGO`;
    return `${Math.floor(diff / 1440)}D AGO`;
}

function classifySeverity(text) {
    const t = text.toLowerCase();
    const high = ['breach', 'ransomware', 'critical', 'zero-day', '0-day', 'vulnerability', 'exploit', 'attack', 'hacked', 'leak'];
    const medium = ['malware', 'phishing', 'update', 'patch', 'security', 'campaign', 'actor', 'threat'];

    if (high.some(word => t.includes(word))) return 'high';
    if (medium.some(word => t.includes(word))) return 'medium';
    return 'low';
}

function detectLevel(text, country) {
    // State level keywords (example Indian states / US states)
    const states = [
        'maharashtra', 'karnataka', 'delhi', 'tamil nadu', 'kerala', 'gujarat',
        'california', 'texas', 'florida', 'new york', 'illinois'
    ];

    if (states.some(s => text.includes(s))) return 'state';
    if (country !== 'global') return 'national';
    return 'world';
}

function toggleWishlist(newsId) {
    const item = state.news.find(n => n.id === newsId) || state.wishlist.find(n => n.id === newsId);
    if (!item) return;

    const index = state.wishlist.findIndex(n => n.id === newsId);
    if (index === -1) {
        state.wishlist.push(item);
    } else {
        state.wishlist.splice(index, 1);
    }

    localStorage.setItem('cyber_wishlist', JSON.stringify(state.wishlist));
    updateMetadata();
    renderNews();
}

function detectCountry(text) {
    const t = text.toLowerCase();
    if (t.includes('india') || t.includes('delhi') || t.includes('mumbai')) return 'in';
    if (t.includes('us ') || t.includes('usa') || t.includes('america') || t.includes('washington')) return 'us';
    if (t.includes('uk ') || t.includes('london') || t.includes('britain')) return 'gb';
    if (t.includes('russia') || t.includes('moscow') || t.includes('kremlin')) return 'ru';
    if (t.includes('china') || t.includes('beijing')) return 'cn';
    return 'global';
}

function getRandomCyberImage() {
    const imgs = [
        'https://images.unsplash.com/photo-1550751827-4bd374c3f58b',
        'https://images.unsplash.com/photo-1624969862644-791f3dc98927',
        'https://images.unsplash.com/photo-1558494949-ef010cbdcc48',
        'https://images.unsplash.com/photo-1677442136019-21780ecad995',
        'https://images.unsplash.com/photo-1576091160550-217359f42f8c'
    ];
    return imgs[Math.floor(Math.random() * imgs.length)] + '?auto=format&fit=crop&q=80&w=800';
}

function updateMetadata() {
    const newsCount = document.getElementById('news-count');
    const lastUpdate = document.getElementById('last-update');
    const threatLevel = document.getElementById('threat-level');
    const activeFeeds = document.getElementById('active-feeds');
    const wishlistBadge = document.getElementById('wishlist-badge');

    const sourceData = state.currentTab === 'live' ? state.news : state.wishlist;
    if (newsCount) newsCount.innerText = sourceData.length.toString().padStart(2, '0');

    if (lastUpdate && state.currentTab === 'live') {
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        lastUpdate.innerText = time;
    } else if (lastUpdate) {
        lastUpdate.innerText = 'OFFLINE';
    }

    if (wishlistBadge) {
        wishlistBadge.innerText = state.wishlist.length;
        wishlistBadge.classList.toggle('hidden', state.wishlist.length === 0);
    }

    const highCount = state.news.filter(n => n.severity === 'high').length;
    if (threatLevel) {
        threatLevel.innerText = highCount > 5 ? 'CRITICAL' : 'ELEVATED';
    }

    if (activeFeeds) activeFeeds.innerText = `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
}

function updateStatus(threat, time) {
    const tl = document.getElementById('threat-level');
    const lu = document.getElementById('last-update');
    if (tl) tl.innerText = threat;
    if (lu) lu.innerText = time;
}

// --- THREE.JS INTRO ---
function initIntro() {
    const canvas = document.getElementById('intro-canvas');
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 5;

    // Earth Sphere
    const geometry = new THREE.SphereGeometry(2, 64, 64);
    const material = new THREE.MeshPhongMaterial({
        color: 0x111111,
        emissive: 0xff0033,
        emissiveIntensity: 0.2,
        wireframe: true,
        transparent: true,
        opacity: 0.8
    });
    const earth = new THREE.Mesh(geometry, material);
    scene.add(earth);

    // Lighting
    const light = new THREE.PointLight(0xff0033, 2, 100);
    light.position.set(10, 10, 10);
    scene.add(light);

    // Animation Loop
    function animate() {
        if (!state.introComplete) {
            requestAnimationFrame(animate);
            earth.rotation.y += 0.005;
            earth.rotation.x += 0.002;
            renderer.render(scene, camera);
        }
    }
    animate();

    // GSAP Intro Sequence
    const tl = gsap.timeline({
        onComplete: () => {
            state.introComplete = true;
            transitionToMain();
        }
    });

    tl.to('#intro-title', { opacity: 1, duration: 1, ease: "power4.out" })
        .to('#intro-subtitle', { opacity: 1, duration: 1 }, "-=0.5")
        .to('#intro-title', { scale: 1.1, duration: 1, repeat: 1, yoyo: true }, "-=1")
        .to('#intro', { opacity: 0, duration: 0.8, delay: 0.2 });
}

// --- THREE.JS MAIN BACKGROUND ---
function initMainBackground() {
    const canvas = document.getElementById('main-canvas');
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 6;

    const geometry = new THREE.SphereGeometry(3, 32, 32);
    const material = new THREE.MeshPhongMaterial({
        color: 0x050505,
        emissive: 0x220000,
        wireframe: true,
        transparent: true,
        opacity: 0.2
    });
    const earth = new THREE.Mesh(geometry, material);
    scene.add(earth);

    const pGeometry = new THREE.BufferGeometry();
    const pMaterial = new THREE.PointsMaterial({ color: 0xff0033, size: 0.02 });
    const pCoords = [];
    for (let i = 0; i < 1000; i++) {
        pCoords.push((Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20);
    }
    pGeometry.setAttribute('position', new THREE.Float32BufferAttribute(pCoords, 3));
    const particles = new THREE.Points(pGeometry, pMaterial);
    scene.add(particles);

    const light = new THREE.DirectionalLight(0xff0033, 1);
    light.position.set(5, 3, 5);
    scene.add(light);

    function animate() {
        requestAnimationFrame(animate);
        earth.rotation.y += 0.001;
        particles.rotation.y += 0.0005;
        renderer.render(scene, camera);
    }
    animate();
}

// --- UI LOGIC ---
function transitionToMain() {
    document.getElementById('intro').style.display = 'none';
    const main = document.getElementById('main-content');
    main.classList.remove('hidden');
    gsap.to(main, { opacity: 1, duration: 1 });
    initMainBackground();
    fetchRealNews();
}

function renderNews() {
    const grid = document.getElementById('news-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const sourceData = state.currentTab === 'live' ? state.news : state.wishlist;

    const filtered = sourceData.filter(n => {
        const matchesCountry = state.currentFilter === 'all' || n.country === state.currentFilter;
        const matchesLevel = state.currentLevel === 'all' || n.level === state.currentLevel;
        const matchesSearch = n.title.toLowerCase().includes(state.searchQuery.toLowerCase()) ||
            n.description.toLowerCase().includes(state.searchQuery.toLowerCase());
        return matchesCountry && matchesSearch && matchesLevel;
    });

    if (state.loading && state.currentTab === 'live') {
        grid.innerHTML = `
            <div class="col-span-full flex flex-col items-center justify-center py-20 gap-4">
                <div class="w-12 h-12 border-2 border-[#ff0033] border-t-transparent rounded-full animate-spin"></div>
                <p class="text-[#ff0033] animate-pulse tracking-[0.3em]">INTERCEPTING SATELLITE DATA...</p>
            </div>
        `;
        return;
    }

    if (filtered.length === 0) {
        const msg = state.currentTab === 'live' ? 'No Intelligence Data For Selected Vector.' : 'No Saved Intel Packets Found.';
        grid.innerHTML = `
            <div class="col-span-full py-20 text-center">
                <p class="text-[#ff0033]/60 italic font-mono uppercase tracking-widest">${msg}</p>
            </div>
        `;
        return;
    }

    filtered.forEach((item, index) => {
        const isSaved = state.wishlist.some(n => n.id === item.id);
        const card = document.createElement('div');
        card.className = `news-card severity-${item.severity} p-4 opacity-0`;
        card.innerHTML = `
            <div class="h-44 overflow-hidden mb-4 relative group/img">
                <img src="${item.image}" alt="intel" class="w-full h-full object-cover grayscale group-hover/img:grayscale-0 group-hover/img:scale-110 transition-all duration-700">
                <div class="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-60"></div>
                <div class="absolute top-2 right-2 flex gap-2">
                    <button onclick="toggleWishlist('${item.id}')" class="p-1.5 bg-black/90 border border-[#ff0033]/30 text-[#ff0033] hover:bg-[#ff0033] hover:text-white transition-all rounded-sm shadow-lg">
                        ${isSaved ?
                '<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17 3H7c-1.1 0-1.99.9-1.99 2L5 21l7-3 7 3V5c0-1.1-.9-2-2-2z"/></svg>' :
                '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M17 3H7c-1.1 0-1.99.9-1.99 2L5 21l7-3 7 3V5c0-1.1-.9-2-2-2z"/></svg>'
            }
                    </button>
                    <div class="px-2 py-1 bg-black/90 border border-[#ff0033]/30 text-[9px] uppercase tracking-tighter font-bold shadow-lg">
                        ${item.severity.toUpperCase()} ALERT
                    </div>
                </div>
            </div>
            <div class="space-y-3">
                <div class="flex justify-between items-start">
                    <span class="text-[9px] text-[#ff0033] font-bold uppercase tracking-widest bg-[#ff0033]/10 px-1.5 py-0.5 border border-[#ff0033]/20">${item.source}</span>
                    <span class="text-[9px] text-[#ff0033]/40 font-mono">${item.time}</span>
                </div>
                <h3 class="text-sm font-bold text-white group-hover:text-[#ff0033] transition-colors leading-[1.3] min-h-[2.6em] line-clamp-2">
                    ${item.title}
                </h3>
                <p class="text-[11px] text-white/50 line-clamp-3 leading-relaxed font-sans">
                    ${item.description}
                </p>
                <div class="pt-3 flex justify-between items-center border-t border-[#ff0033]/10">
                    <div class="flex flex-col gap-1">
                        <div class="flex items-center gap-1.5">
                            <span class="w-1 h-1 rounded-full bg-[#ff0033] animate-ping"></span>
                            <span class="text-[9px] text-[#ff0033]/60 font-mono uppercase">${item.level} LEVEL</span>
                        </div>
                        <span class="text-[8px] text-[#ff0033]/40 font-mono">NODE: ${item.country.toUpperCase()}</span>
                    </div>
                    <a href="${item.link}" target="_blank" class="text-[10px] text-[#ff0033] hover:text-white transition-colors cursor-pointer tracking-widest font-bold flex items-center gap-1 group/link">
                        ACCESS REPORT 
                        <svg class="w-3 h-3 group-hover/link:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
                    </a>
                </div>
            </div>
        `;
        grid.appendChild(card);
        gsap.to(card, { opacity: 1, y: 0, duration: 0.6, delay: Math.min(index * 0.05, 1), ease: "power2.out" });
    });
}

// --- EVENT LISTENERS ---
function setupListeners() {
    document.getElementById('country-filter').addEventListener('change', (e) => {
        state.currentFilter = e.target.value;
        renderNews();
    });

    document.getElementById('level-filter').addEventListener('change', (e) => {
        state.currentLevel = e.target.value;
        renderNews();
    });

    document.getElementById('news-search').addEventListener('input', (e) => {
        state.searchQuery = e.target.value;
        renderNews();
    });

    document.getElementById('tab-live').addEventListener('click', () => {
        state.currentTab = 'live';
        document.getElementById('tab-live').classList.add('border-b-2', 'border-[#ff0033]');
        document.getElementById('tab-live').classList.remove('text-[#ff0033]/50');
        document.getElementById('tab-saved').classList.remove('border-b-2', 'border-[#ff0033]');
        document.getElementById('tab-saved').classList.add('text-[#ff0033]/50');
        renderNews();
        updateMetadata();
    });

    document.getElementById('tab-saved').addEventListener('click', () => {
        state.currentTab = 'saved';
        document.getElementById('tab-saved').classList.add('border-b-2', 'border-[#ff0033]');
        document.getElementById('tab-saved').classList.remove('text-[#ff0033]/50');
        document.getElementById('tab-live').classList.remove('border-b-2', 'border-[#ff0033]');
        document.getElementById('tab-live').classList.add('text-[#ff0033]/50');
        renderNews();
        updateMetadata();
    });

    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            const icon = document.getElementById('refresh-icon');
            if (icon) {
                gsap.to(icon, {
                    rotation: 360, duration: 0.5, onComplete: () => {
                        gsap.set(icon, { rotation: 0 });
                        fetchRealNews();
                    }
                });
            }
        });
    }
}

// Initialize
window.onload = () => {
    initIntro();
    setupListeners();
};
