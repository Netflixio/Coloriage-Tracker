/* =========================================================
   MES COLORIAGES — Couche de stockage (IndexedDB)
   =========================================================
   Schéma :
   - books        { id, title, author, notes, totalPages, cover (blob),
                    purchaseYear, tags[], archived, createdAt, updatedAt, sortIndex }
   - pageEntries   { id, bookId, pageNumber, year (null si pas coloriée),
                    photo, tags[], updatedAt }
                    (une entrée existe dès qu'une page a une année ET/OU des tags ;
                    year = null signifie "non coloriée mais possède des tags")
   - years         { year, color }   (couleur personnalisable par année)
   - tags          { name, categories[] }  (registre global des tags connus ;
                    categories[] = noms de catégories, "Sans catégorie" par défaut)
   - tagCategories { name }          (registre libre des catégories de tags)
   - challenges    { id, title, instructions, cover, startDate, endDate, year,
                    status ('todo'|'in_progress'|'done'), prizeWon, items[],
                    createdAt, updatedAt, sortIndex }
                    (items[] = [{ id, label, checked }] — cases à cocher du challenge)
   - wishlist      { id, type ('book'|'gear'), title, image, link, desire (1-5),
                    tags[], obtained, createdAt, updatedAt, sortIndex }
   - gearItems     { id, type ('simple'|'box'), title, brand, image, notes,
                    categories[], medium (nom du médium ou null), units[],
                    createdAt, updatedAt, sortIndex }
                    (units[] = [{ id, name, reference (facultatif), color
                    (hex ou null), status: 'ok'|'missing'|'dead' }] —
                    name et reference sont chacun facultatifs mais
                    au moins l'un des deux doit être renseigné)
   - gearCategories { name }  (registre libre des catégories de matériel)
   - gearMediums   { name }   (registre libre des médiums : feutre, crayon...)
   - combos        { id, title (facultatif), images[] (au moins une obligatoire),
                    categories[], colorRefs[], createdAt, updatedAt, sortIndex }
                    (colorRefs[] = [{ gearItemId, unitId }] — référence une
                    couleur précise de la trousse ; l'affichage (pastille,
                    marque, référence/nom) est résolu à la volée depuis la
                    trousse, donc toujours à jour si la couleur change)
   - comboCategories { name }  (registre libre des catégories de combo)
   - characters    { id, title (obligatoire), image (obligatoire),
                    markers[], createdAt, updatedAt, sortIndex }
                    (markers[] = [{ id, label, x, y, gearItemId, unitId }] —
                    x/y en pourcentage (0-100) de la position sur l'image,
                    pour rester valides peu importe la taille d'affichage ;
                    gearItemId/unitId réfèrent une couleur précise de la
                    trousse, résolue à la volée comme pour les combos)
   - meta          { key, value }    (préférences diverses : thème, etc.)
   ========================================================= */

const DB_NAME = 'coloriage-tracker';
const DB_VERSION = 14;
const UNCATEGORIZED_TAG_CATEGORY = 'Sans catégorie';
const UNCATEGORIZED_GEAR_CATEGORY = 'Sans catégorie';
const UNCATEGORIZED_CATEGORY = 'Sans catégorie'; // catégorie par défaut partagée

let _dbPromise = null;

function openDB() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    // Bloqué = l'app est ouverte dans un autre onglet avec une ancienne version
    req.onblocked = () => {
      console.error('[DB] Mise à jour bloquée — ferme les autres onglets de l\'app et recharge.');
      reject(new Error('DB bloquée — ferme les autres onglets et recharge la page.'));
    };

    req.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains('books')) {
        const books = db.createObjectStore('books', { keyPath: 'id' });
        books.createIndex('archived', 'archived');
        books.createIndex('sortIndex', 'sortIndex');
      }

      if (!db.objectStoreNames.contains('pageEntries')) {
        const pages = db.createObjectStore('pageEntries', { keyPath: 'id' });
        pages.createIndex('bookId', 'bookId');
        pages.createIndex('bookId_page', ['bookId', 'pageNumber'], { unique: true });
        pages.createIndex('year', 'year');
      }

      if (!db.objectStoreNames.contains('years')) {
        db.createObjectStore('years', { keyPath: 'year' });
      }

      if (!db.objectStoreNames.contains('tags')) {
        db.createObjectStore('tags', { keyPath: 'name' });
      }

      if (!db.objectStoreNames.contains('tagCategories')) {
        db.createObjectStore('tagCategories', { keyPath: 'name' });
      }

      if (!db.objectStoreNames.contains('challenges')) {
        const challenges = db.createObjectStore('challenges', { keyPath: 'id' });
        challenges.createIndex('status', 'status');
        challenges.createIndex('sortIndex', 'sortIndex');
      }

      if (!db.objectStoreNames.contains('wishlist')) {
        const wishlist = db.createObjectStore('wishlist', { keyPath: 'id' });
        wishlist.createIndex('type', 'type');
        wishlist.createIndex('sortIndex', 'sortIndex');
      }

      if (!db.objectStoreNames.contains('gearItems')) {
        const gearItems = db.createObjectStore('gearItems', { keyPath: 'id' });
        gearItems.createIndex('sortIndex', 'sortIndex');
      }

      if (!db.objectStoreNames.contains('gearCategories')) {
        db.createObjectStore('gearCategories', { keyPath: 'name' });
      }

      if (!db.objectStoreNames.contains('gearMediums')) {
        db.createObjectStore('gearMediums', { keyPath: 'name' });
      }

      if (!db.objectStoreNames.contains('combos')) {
        const combos = db.createObjectStore('combos', { keyPath: 'id' });
        combos.createIndex('sortIndex', 'sortIndex');
      }

      if (!db.objectStoreNames.contains('comboCategories')) {
        db.createObjectStore('comboCategories', { keyPath: 'name' });
      }

      if (!db.objectStoreNames.contains('characters')) {
        const characters = db.createObjectStore('characters', { keyPath: 'id' });
        characters.createIndex('sortIndex', 'sortIndex');
      }

      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', { keyPath: 'key' });
      }

      if (!db.objectStoreNames.contains('bookTypes')) {
        const bookTypes = db.createObjectStore('bookTypes', { keyPath: 'id' });
        bookTypes.createIndex('sortIndex', 'sortIndex');
      }

      if (!db.objectStoreNames.contains('palettes')) {
        db.createObjectStore('palettes', { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains('techniques')) {
        db.createObjectStore('techniques', { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains('characterCategories')) {
        db.createObjectStore('characterCategories', { keyPath: 'name' });
      }

      if (!db.objectStoreNames.contains('paletteCategories')) {
        db.createObjectStore('paletteCategories', { keyPath: 'name' });
      }

      if (!db.objectStoreNames.contains('techniqueCategories')) {
        db.createObjectStore('techniqueCategories', { keyPath: 'name' });
      }

      if (!db.objectStoreNames.contains('missions')) {
        db.createObjectStore('missions', { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains('colocopines')) {
        db.createObjectStore('colocopines', { keyPath: 'id' });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return _dbPromise;
}

function tx(storeNames, mode = 'readonly') {
  return openDB().then(db => db.transaction(storeNames, mode));
}

function reqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function uid() {
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);
}

/* ---------- API : BOOKS ---------- */

const BooksAPI = {
  async getAll() {
    const t = await tx(['books']);
    const store = t.objectStore('books');
    const all = await reqToPromise(store.getAll());
    return all.sort((a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0));
  },

  async get(id) {
    const t = await tx(['books']);
    return reqToPromise(t.objectStore('books').get(id));
  },

  async create(data) {
    const t = await tx(['books'], 'readwrite');
    const store = t.objectStore('books');
    const countReq = await reqToPromise(store.getAll());
    const maxSort = countReq.reduce((m, b) => Math.max(m, b.sortIndex ?? 0), 0);

    const book = {
      id: uid(),
      title: data.title.trim(),
      author: (data.author || '').trim(),
      notes: (data.notes || '').trim(),
      totalPages: data.totalPages,
      purchaseYear: data.purchaseYear || null, // année d'achat, optionnelle
      tags: data.tags || [], // étiquettes libres pour la recherche
      bookType: data.bookType || null, // type de livre personnalisable (un seul à la fois), id de bookTypes ou null
      inPile: false, // "Ma pile à colorier" : mise en avant volontaire, indépendante du tri
      cover: data.cover || null, // base64 string ou null
      archived: false,
      active: data.active !== false, // true par défaut — false = exclu stats/badges/carrousel
      createdAt: Date.now(),
      updatedAt: Date.now(),
      sortIndex: maxSort + 1,
    };
    await reqToPromise(store.add(book));
    return book;
  },

  async update(id, patch) {
    const t = await tx(['books'], 'readwrite');
    const store = t.objectStore('books');
    const existing = await reqToPromise(store.get(id));
    if (!existing) throw new Error('Livre introuvable');
    const updated = { ...existing, ...patch, updatedAt: Date.now() };
    await reqToPromise(store.put(updated));
    return updated;
  },

  async reorderInGroup(mode, orderedBookIds) {
    // Enregistre un ordre personnalisé pour un groupe de livres (ex. tous les
    // livres de l'étagère "2024" en mode "purchaseYear"), sans toucher à
    // l'ordre des livres dans les AUTRES modes de tri : chaque mode garde
    // son propre arrangement manuel, complètement indépendant des autres.
    const t = await tx(['books'], 'readwrite');
    const store = t.objectStore('books');
    for (let i = 0; i < orderedBookIds.length; i++) {
      const existing = await reqToPromise(store.get(orderedBookIds[i]));
      if (!existing) continue;
      const customOrders = { ...(existing.customOrders || {}), [mode]: i };
      await reqToPromise(store.put({ ...existing, customOrders, updatedAt: Date.now() }));
    }
  },

  async remove(id) {
    const t = await tx(['books', 'pageEntries'], 'readwrite');
    t.objectStore('books').delete(id);
    // Supprime aussi toutes les entrées de pages associées
    const pageStore = t.objectStore('pageEntries');
    const idx = pageStore.index('bookId');
    const cursorReq = idx.openCursor(IDBKeyRange.only(id));
    await new Promise((resolve, reject) => {
      cursorReq.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };
      cursorReq.onerror = () => reject(cursorReq.error);
    });
  },

  async setArchived(id, archived) {
    return this.update(id, { archived });
  },
};

/* ---------- API : PAGE ENTRIES ---------- */

const PagesAPI = {
  async getForBook(bookId) {
    const t = await tx(['pageEntries']);
    const idx = t.objectStore('pageEntries').index('bookId');
    return reqToPromise(idx.getAll(IDBKeyRange.only(bookId)));
  },

  async getEntry(bookId, pageNumber) {
    const t = await tx(['pageEntries']);
    const idx = t.objectStore('pageEntries').index('bookId_page');
    return reqToPromise(idx.get([bookId, pageNumber]));
  },

  async _getOrCreateEntry(store, bookId, pageNumber) {
    const idx = store.index('bookId_page');
    const existing = await reqToPromise(idx.get([bookId, pageNumber]));
    if (existing) return existing;
    return {
      id: uid(),
      bookId,
      pageNumber,
      year: null,   // pas encore coloriée
      status: null, // null = normal | 'in_progress' | 'abandoned' | 'failed' | 'kevin'
      photo: null,
      tags: [],
      updatedAt: Date.now(),
    };
  },

  async setPageYear(bookId, pageNumber, year) {
    const t = await tx(['pageEntries'], 'readwrite');
    const store = t.objectStore('pageEntries');
    const entry = await this._getOrCreateEntry(store, bookId, pageNumber);
    const updated = { ...entry, year, updatedAt: Date.now() };
    await reqToPromise(store.put(updated));
    return updated;
  },

  async setPageStatus(bookId, pageNumber, status) {
    // Un statut spécial (en cours, abandonnée, ratée, Kévin) peut exister
    // avec ou sans année assignée — il ne remplace pas l'année, il s'ajoute
    // par-dessus, et c'est lui qui décide si la page compte dans les stats
    // de pages "vraiment" coloriées.
    const t = await tx(['pageEntries'], 'readwrite');
    const store = t.objectStore('pageEntries');
    const entry = await this._getOrCreateEntry(store, bookId, pageNumber);
    const updated = { ...entry, status, updatedAt: Date.now() };
    await reqToPromise(store.put(updated));
    return updated;
  },

  async setPageFavorite(bookId, pageNumber, favorite) {
    const t = await tx(['pageEntries'], 'readwrite');
    const store = t.objectStore('pageEntries');
    const entry = await this._getOrCreateEntry(store, bookId, pageNumber);
    const updated = { ...entry, favorite, updatedAt: Date.now() };
    await reqToPromise(store.put(updated));
    return updated;
  },

  async setPageColocopine(bookId, pageNumber, colocopineId) {
    const t = await tx(['pageEntries'], 'readwrite');
    const store = t.objectStore('pageEntries');
    const entry = await this._getOrCreateEntry(store, bookId, pageNumber);
    // Gérer un tableau de colocopineIds pour duo/trio/plus
    const currentIds = entry.colocopineIds || (entry.colocopineId ? [entry.colocopineId] : []);
    let newIds;
    if (!colocopineId) {
      // Retirer toutes les colocopines
      newIds = [];
    } else if (currentIds.includes(colocopineId)) {
      // Déjà présente → retirer (toggle)
      newIds = currentIds.filter(id => id !== colocopineId);
    } else {
      // Ajouter
      newIds = [...currentIds, colocopineId];
    }
    const updated = { ...entry, colocopineIds: newIds, colocopineId: newIds[0] || null, updatedAt: Date.now() };
    await reqToPromise(store.put(updated));
    return updated;
  },

  async setPageGroupStatus(bookId, pageNumber, groupStatus) {
    // groupStatus: null (Solo, valeur par défaut) | 'duo' | 'trio' | 'plus'
    const t = await tx(['pageEntries'], 'readwrite');
    const store = t.objectStore('pageEntries');
    const entry = await this._getOrCreateEntry(store, bookId, pageNumber);
    // Si on repasse en Solo, on retire aussi les photos secondaires
    // devenues incohérentes (rien à montrer en duo s'il n'y a plus de duo).
    const secondaryPhotos = groupStatus ? (entry.secondaryPhotos || []) : [];
    const updated = { ...entry, groupStatus, secondaryPhotos, updatedAt: Date.now() };
    await reqToPromise(store.put(updated));
    return updated;
  },

  async setPagePostedOnInstagram(bookId, pageNumber, posted) {
    const t = await tx(['pageEntries'], 'readwrite');
    const store = t.objectStore('pageEntries');
    const entry = await this._getOrCreateEntry(store, bookId, pageNumber);
    const updated = { ...entry, postedOnInstagram: posted, updatedAt: Date.now() };
    await reqToPromise(store.put(updated));
    return updated;
  },

  async setSecondaryPhoto(bookId, pageNumber, index, photoDataUrl, personName) {
    // index: position dans le tableau secondaryPhotos (0 pour la 1ère
    // personne du duo, 1 pour la 2e du trio, etc.) — passer photoDataUrl à
    // null retire cette entrée précise sans décaler les autres.
    const t = await tx(['pageEntries'], 'readwrite');
    const store = t.objectStore('pageEntries');
    const entry = await this._getOrCreateEntry(store, bookId, pageNumber);
    const secondaryPhotos = [...(entry.secondaryPhotos || [])];
    if (photoDataUrl === null) {
      secondaryPhotos[index] = null;
    } else {
      secondaryPhotos[index] = { photo: photoDataUrl, personName: (personName || '').trim() };
    }
    const updated = { ...entry, secondaryPhotos, updatedAt: Date.now() };
    await reqToPromise(store.put(updated));
    return updated;
  },

  async getAllFavorites() {
    // Toutes les pages favorites, tous livres confondus, avec une photo —
    // une page sans photo n'a rien à montrer dans une galerie visuelle.
    const t = await tx(['pageEntries']);
    const all = await reqToPromise(t.objectStore('pageEntries').getAll());
    return all.filter(e => e.favorite && e.photo);
  },

  async setPagePhoto(bookId, pageNumber, photoDataUrl) {
    const t = await tx(['pageEntries'], 'readwrite');
    const store = t.objectStore('pageEntries');
    const idx = store.index('bookId_page');
    const existing = await reqToPromise(idx.get([bookId, pageNumber]));
    if (!existing || !existing.year) {
      throw new Error("Impossible d'ajouter une photo : cette page n'a pas encore d'année assignée.");
    }
    const updated = { ...existing, photo: photoDataUrl, updatedAt: Date.now() };
    await reqToPromise(store.put(updated));
    return updated;
  },

  async setPagePhotoOffset(bookId, pageNumber, offsetX) {
    // Décalage horizontal (-50 à +50, en %) pour cadrer la photo d'une
    // double page sans qu'une coupure ne soit visible au milieu — stocké
    // uniquement sur la première page de la paire fusionnée.
    const t = await tx(['pageEntries'], 'readwrite');
    const store = t.objectStore('pageEntries');
    const idx = store.index('bookId_page');
    const existing = await reqToPromise(idx.get([bookId, pageNumber]));
    if (!existing) throw new Error("Cette page n'existe pas encore.");
    const updated = { ...existing, photoOffsetX: offsetX, updatedAt: Date.now() };
    await reqToPromise(store.put(updated));
    return updated;
  },

  async setPageTags(bookId, pageNumber, tags) {
    // Les tags peuvent exister même sans année assignée : on crée donc
    // l'entrée si besoin, sans jamais y forcer une année.
    const t = await tx(['pageEntries'], 'readwrite');
    const store = t.objectStore('pageEntries');
    const entry = await this._getOrCreateEntry(store, bookId, pageNumber);
    const updated = { ...entry, tags: [...new Set(tags)], updatedAt: Date.now() };
    await reqToPromise(store.put(updated));
    return updated;
  },

  // Variante de setPageTags qui stocke aussi bookTags (tags hérités du livre,
  // séparément des tags manuels) pour distinguer les deux dans l'UI (pastille verte).
  async setPageTagsWithBookTags(bookId, pageNumber, tags, bookTags) {
    const t = await tx(['pageEntries'], 'readwrite');
    const store = t.objectStore('pageEntries');
    const entry = await this._getOrCreateEntry(store, bookId, pageNumber);
    const updated = { ...entry, tags: [...new Set(tags)], bookTags: [...new Set(bookTags)], updatedAt: Date.now() };
    await reqToPromise(store.put(updated));
    return updated;
  },

  async clearPage(bookId, pageNumber) {
    // Remet la page à "non coloriée" mais conserve ses tags et son statut
    // spécial s'il en existe : remettre à zéro l'année ne doit pas faire
    // perdre les étiquettes de contenu ni un état comme "Kévin".
    const t = await tx(['pageEntries'], 'readwrite');
    const store = t.objectStore('pageEntries');
    const idx = store.index('bookId_page');
    const existing = await reqToPromise(idx.get([bookId, pageNumber]));
    if (!existing) return;

    const hasTags = existing.tags && existing.tags.length > 0;
    const hasStatus = !!existing.status;
    if (hasTags || hasStatus) {
      const updated = { ...existing, year: null, photo: null, updatedAt: Date.now() };
      await reqToPromise(store.put(updated));
    } else {
      await reqToPromise(store.delete(existing.id));
    }
  },

  async getAll() {
    const t = await tx(['pageEntries']);
    return reqToPromise(t.objectStore('pageEntries').getAll());
  },
};

/* ---------- API : YEARS (couleurs personnalisables) ---------- */

const DEFAULT_YEAR_PALETTE = [
  '#D88C5A', '#7A9E7E', '#E2C14D', '#6B8CAE', '#B57BA6',
  '#C45B4F', '#8C9E5A', '#5A8C8C', '#A67BC4', '#D8A85A',
];

const YearsAPI = {
  async getAll() {
    const t = await tx(['years']);
    const all = await reqToPromise(t.objectStore('years').getAll());
    return all.sort((a, b) => a.year - b.year);
  },

  async ensureYear(year) {
    const t = await tx(['years'], 'readwrite');
    const store = t.objectStore('years');
    const existing = await reqToPromise(store.get(year));
    if (existing) return existing;

    const all = await reqToPromise(store.getAll());
    const color = DEFAULT_YEAR_PALETTE[all.length % DEFAULT_YEAR_PALETTE.length];
    const entry = { year, color };
    await reqToPromise(store.add(entry));
    return entry;
  },

  async setColor(year, color) {
    const t = await tx(['years'], 'readwrite');
    const store = t.objectStore('years');
    const existing = await reqToPromise(store.get(year));
    const entry = existing ? { ...existing, color } : { year, color };
    await reqToPromise(store.put(entry));
    return entry;
  },

  async countUsage(year) {
    const t = await tx(['pageEntries', 'challenges']);
    const entries = await reqToPromise(t.objectStore('pageEntries').getAll());
    const challenges = await reqToPromise(t.objectStore('challenges').getAll());
    const pageCount = entries.filter(e => e.year === year).length;
    const challengeCount = challenges.filter(c => c.year === year).length;
    return { pageCount, challengeCount };
  },

  async renameYear(oldYear, newYear) {
    // Corrige une erreur de saisie sur le numéro d'une année (ex. 2800 → 2024).
    // Si la nouvelle valeur correspond à une année déjà existante, on FUSIONNE :
    // la couleur de l'année cible est conservée, et toutes les pages/challenges
    // de l'ancienne année basculent vers la nouvelle. L'ancienne entrée est
    // alors supprimée pour ne pas laisser de doublon.
    if (oldYear === newYear) return;

    const t = await tx(['years', 'pageEntries', 'challenges'], 'readwrite');
    const yearStore = t.objectStore('years');
    const oldEntry = await reqToPromise(yearStore.get(oldYear));
    if (!oldEntry) throw new Error('Année introuvable.');

    const targetEntry = await reqToPromise(yearStore.get(newYear));

    if (!targetEntry) {
      // Pas de collision : on renomme simplement l'entrée en gardant sa couleur.
      await reqToPromise(yearStore.delete(oldYear));
      await reqToPromise(yearStore.put({ year: newYear, color: oldEntry.color }));
    } else {
      // Collision : l'année cible existe déjà, on fusionne dedans (sa couleur prime)
      // et on supprime l'ancienne entrée devenue inutile.
      await reqToPromise(yearStore.delete(oldYear));
    }

    // Bascule toutes les pages et challenges de l'ancienne année vers la nouvelle.
    const pageStore = t.objectStore('pageEntries');
    const entries = await reqToPromise(pageStore.getAll());
    for (const entry of entries) {
      if (entry.year === oldYear) {
        await reqToPromise(pageStore.put({ ...entry, year: newYear, updatedAt: Date.now() }));
      }
    }

    const challengeStore = t.objectStore('challenges');
    const challenges = await reqToPromise(challengeStore.getAll());
    for (const challenge of challenges) {
      if (challenge.year === oldYear) {
        await reqToPromise(challengeStore.put({ ...challenge, year: newYear, updatedAt: Date.now() }));
      }
    }

    return { merged: !!targetEntry };
  },

  async deleteYear(year) {
    // Suppression simple, réservée aux années inutilisées (ex. une pastille
    // créée par erreur). Pour une année déjà utilisée, on guide plutôt vers
    // renameYear : la corriger a plus de sens que la supprimer.
    const { pageCount, challengeCount } = await this.countUsage(year);
    if (pageCount > 0 || challengeCount > 0) {
      throw new Error("Cette année est utilisée par au moins une page ou un challenge : modifie son numéro plutôt que de la supprimer.");
    }
    const t = await tx(['years'], 'readwrite');
    await reqToPromise(t.objectStore('years').delete(year));
  },
};

/* ---------- API : TAGS (registre global, pour l'auto-complétion) ---------- */

const TagsAPI = {
  async getAll() {
    const t = await tx(['tags']);
    const all = await reqToPromise(t.objectStore('tags').getAll());
    return all.map(t => t.name).sort((a, b) => a.localeCompare(b, 'fr'));
  },

  async getAllWithCategories() {
    const t = await tx(['tags']);
    const all = await reqToPromise(t.objectStore('tags').getAll());
    return all
      .map(t => ({ name: t.name, categories: t.categories && t.categories.length > 0 ? t.categories : [UNCATEGORIZED_TAG_CATEGORY] }))
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  },

  async ensureTags(names) {
    if (!names || names.length === 0) return;
    const t = await tx(['tags'], 'readwrite');
    const store = t.objectStore('tags');
    for (const name of names) {
      const clean = name.trim();
      if (!clean) continue;
      const existing = await reqToPromise(store.get(clean));
      // Un nouveau tag tombe par défaut dans "Sans catégorie", pour que
      // rien ne se perde dans la vue par catégorie tant qu'il n'est pas
      // rangé ailleurs.
      if (!existing) await reqToPromise(store.put({ name: clean, categories: [UNCATEGORIZED_TAG_CATEGORY] }));
    }
  },

  async setTagCategories(name, categories) {
    const t = await tx(['tags'], 'readwrite');
    const store = t.objectStore('tags');
    const existing = await reqToPromise(store.get(name));
    if (!existing) return;
    const clean = [...new Set(categories)];
    const updated = { ...existing, categories: clean.length > 0 ? clean : [UNCATEGORIZED_TAG_CATEGORY] };
    await reqToPromise(store.put(updated));
    return updated;
  },

  async countUsage(name) {
    const t = await tx(['books', 'pageEntries']);
    const books = await reqToPromise(t.objectStore('books').getAll());
    const entries = await reqToPromise(t.objectStore('pageEntries').getAll());
    const bookCount = books.filter(b => (b.tags || []).includes(name)).length;
    const pageCount = entries.filter(e => (e.tags || []).includes(name)).length;
    return { bookCount, pageCount };
  },

  // Version batch : une seule passe IndexedDB pour TOUS les tags — bien plus rapide
  async countUsageAll() {
    const t = await tx(['books', 'pageEntries']);
    const books = await reqToPromise(t.objectStore('books').getAll());
    const entries = await reqToPromise(t.objectStore('pageEntries').getAll());
    const bookMap = new Map();
    const pageMap = new Map();
    for (const b of books) {
      for (const tag of (b.tags || [])) {
        bookMap.set(tag, (bookMap.get(tag) || 0) + 1);
      }
    }
    for (const e of entries) {
      for (const tag of (e.tags || [])) {
        pageMap.set(tag, (pageMap.get(tag) || 0) + 1);
      }
    }
    return { bookMap, pageMap };
  },

  async deleteTagEverywhere(name) {
    // Retire le tag de tous les livres et de toutes les pages qui l'utilisent,
    // puis le retire du registre global. Action irréversible et complète,
    // sur le même principe que la suppression d'une couleur d'année.
    const t = await tx(['books', 'pageEntries', 'tags'], 'readwrite');

    const bookStore = t.objectStore('books');
    const books = await reqToPromise(bookStore.getAll());
    for (const book of books) {
      if ((book.tags || []).includes(name)) {
        const updated = { ...book, tags: book.tags.filter(tg => tg !== name), updatedAt: Date.now() };
        await reqToPromise(bookStore.put(updated));
      }
    }

    const pageStore = t.objectStore('pageEntries');
    const entries = await reqToPromise(pageStore.getAll());
    for (const entry of entries) {
      if ((entry.tags || []).includes(name)) {
        const remainingTags = entry.tags.filter(tg => tg !== name);
        // Si l'entrée n'a plus ni année ni tags ni photo ni statut, elle ne sert plus à rien : on la supprime.
        if (remainingTags.length === 0 && !entry.year && !entry.photo && !entry.status) {
          await reqToPromise(pageStore.delete(entry.id));
        } else {
          await reqToPromise(pageStore.put({ ...entry, tags: remainingTags, updatedAt: Date.now() }));
        }
      }
    }

    await reqToPromise(t.objectStore('tags').delete(name));
  },
};

/* ---------- API : TAG CATEGORIES (registre libre des catégories) ---------- */

const TagCategoriesAPI = {
  async getAll() {
    const t = await tx(['tagCategories']);
    const all = await reqToPromise(t.objectStore('tagCategories').getAll());
    // Trier par sortIndex si disponible, sinon alphabétique
    all.sort((a, b) => {
      if (a.name === UNCATEGORIZED_TAG_CATEGORY) return 1;
      if (b.name === UNCATEGORIZED_TAG_CATEGORY) return -1;
      if (a.sortIndex !== undefined && b.sortIndex !== undefined) return a.sortIndex - b.sortIndex;
      return a.name.localeCompare(b.name, 'fr');
    });
    const names = all.map(c => c.name);
    if (!names.includes(UNCATEGORIZED_TAG_CATEGORY)) names.push(UNCATEGORIZED_TAG_CATEGORY);
    return names;
  },

  async reorder(orderedNames) {
    const t = await tx(['tagCategories'], 'readwrite');
    const store = t.objectStore('tagCategories');
    const all = await reqToPromise(store.getAll());
    const puts = orderedNames.map((name, i) => {
      const existing = all.find(c => c.name === name) || { name };
      return reqToPromise(store.put({ ...existing, sortIndex: i }));
    });
    await Promise.all(puts);
  },

  async create(name) {
    const clean = name.trim();
    if (!clean) return;
    const t = await tx(['tagCategories'], 'readwrite');
    const store = t.objectStore('tagCategories');
    const existing = await reqToPromise(store.get(clean));
    if (!existing) await reqToPromise(store.put({ name: clean }));
  },

  async delete(name) {
    if (name === UNCATEGORIZED_TAG_CATEGORY) {
      throw new Error('"Sans catégorie" ne peut pas être supprimée : c\'est le panier par défaut.');
    }
    // Retire la catégorie de tous les tags qui l'utilisaient, puis supprime
    // la catégorie elle-même. Les tags qui se retrouvent sans catégorie du
    // tout retombent automatiquement dans "Sans catégorie" (géré à la lecture).
    const t = await tx(['tags', 'tagCategories'], 'readwrite');
    const tagStore = t.objectStore('tags');
    const tags = await reqToPromise(tagStore.getAll());
    for (const tag of tags) {
      if ((tag.categories || []).includes(name)) {
        const remaining = tag.categories.filter(c => c !== name);
        await reqToPromise(tagStore.put({ ...tag, categories: remaining }));
      }
    }
    await reqToPromise(t.objectStore('tagCategories').delete(name));
  },
};

/* ---------- API : CHALLENGES ---------- */

const ChallengesAPI = {
  async getAll() {
    const t = await tx(['challenges']);
    const all = await reqToPromise(t.objectStore('challenges').getAll());
    return all.sort((a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0));
  },

  async get(id) {
    const t = await tx(['challenges']);
    return reqToPromise(t.objectStore('challenges').get(id));
  },

  async create(data) {
    const t = await tx(['challenges'], 'readwrite');
    const store = t.objectStore('challenges');
    const all = await reqToPromise(store.getAll());
    const maxSort = all.reduce((m, c) => Math.max(m, c.sortIndex ?? 0), 0);

    const challenge = {
      id: uid(),
      title: data.title.trim(),
      instructions: (data.instructions || '').trim(),
      cover: data.cover || null,
      prize: data.prize || null,
      link: data.link || null,
      priority: data.priority || 0,
      startDate: data.startDate || null,
      endDate: data.endDate || null,
      year: data.year || null,
      status: data.status || 'todo',
      prizeWon: false,
      items: data.items || [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      sortIndex: maxSort + 1,
    };
    await reqToPromise(store.add(challenge));
    return challenge;
  },

  async update(id, patch) {
    const t = await tx(['challenges'], 'readwrite');
    const store = t.objectStore('challenges');
    const existing = await reqToPromise(store.get(id));
    if (!existing) throw new Error('Challenge introuvable');
    const updated = { ...existing, ...patch, updatedAt: Date.now() };
    await reqToPromise(store.put(updated));
    return updated;
  },

  async remove(id) {
    const t = await tx(['challenges'], 'readwrite');
    await reqToPromise(t.objectStore('challenges').delete(id));
  },

  async setItemChecked(challengeId, itemId, checked) {
    const t = await tx(['challenges'], 'readwrite');
    const store = t.objectStore('challenges');
    const existing = await reqToPromise(store.get(challengeId));
    if (!existing) throw new Error('Challenge introuvable');
    const items = existing.items.map(it => it.id === itemId ? { ...it, checked } : it);
    const updated = { ...existing, items, updatedAt: Date.now() };
    await reqToPromise(store.put(updated));
    return updated;
  },

  async setItemLabel(challengeId, itemId, label) {
    const t = await tx(['challenges'], 'readwrite');
    const store = t.objectStore('challenges');
    const existing = await reqToPromise(store.get(challengeId));
    if (!existing) throw new Error('Challenge introuvable');
    const items = existing.items.map(it => it.id === itemId ? { ...it, label } : it);
    const updated = { ...existing, items, updatedAt: Date.now() };
    await reqToPromise(store.put(updated));
    return updated;
  },

  async setItemLinkedPage(challengeId, itemId, linkedPage) {
    // linkedPage = { bookId, pageNumber } | null — lien facultatif vers une
    // page précise d'un livre, complètement indépendant de la coche/du texte.
    const t = await tx(['challenges'], 'readwrite');
    const store = t.objectStore('challenges');
    const existing = await reqToPromise(store.get(challengeId));
    if (!existing) throw new Error('Challenge introuvable');
    const items = existing.items.map(it => it.id === itemId ? { ...it, linkedPage } : it);
    const updated = { ...existing, items, updatedAt: Date.now() };
    await reqToPromise(store.put(updated));
    return updated;
  },

  async addItem(challengeId, label = '') {
    const t = await tx(['challenges'], 'readwrite');
    const store = t.objectStore('challenges');
    const existing = await reqToPromise(store.get(challengeId));
    if (!existing) throw new Error('Challenge introuvable');
    const items = [...existing.items, { id: uid(), label, checked: false, linkedPage: null }];
    const updated = { ...existing, items, updatedAt: Date.now() };
    await reqToPromise(store.put(updated));
    return updated;
  },

  async removeItem(challengeId, itemId) {
    const t = await tx(['challenges'], 'readwrite');
    const store = t.objectStore('challenges');
    const existing = await reqToPromise(store.get(challengeId));
    if (!existing) throw new Error('Challenge introuvable');
    const items = existing.items.filter(it => it.id !== itemId);
    const updated = { ...existing, items, updatedAt: Date.now() };
    await reqToPromise(store.put(updated));
    return updated;
  },
};

/* ---------- API : WISHLIST ---------- */

const WishlistAPI = {
  async getAll() {
    const t = await tx(['wishlist']);
    const all = await reqToPromise(t.objectStore('wishlist').getAll());
    return all.sort((a, b) => (b.sortIndex ?? 0) - (a.sortIndex ?? 0)); // plus récent en premier
  },

  async get(id) {
    const t = await tx(['wishlist']);
    return reqToPromise(t.objectStore('wishlist').get(id));
  },

  async create(data) {
    const t = await tx(['wishlist'], 'readwrite');
    const store = t.objectStore('wishlist');
    const all = await reqToPromise(store.getAll());
    const maxSort = all.reduce((m, w) => Math.max(m, w.sortIndex ?? 0), 0);

    const item = {
      id: uid(),
      type: data.type === 'gear' ? 'gear' : 'book', // 'book' | 'gear'
      title: data.title.trim(),
      image: data.image || null,
      link: (data.link || '').trim() || null,
      price: typeof data.price === 'number' ? data.price : null,
      desire: Math.min(5, Math.max(1, data.desire || 3)),
      tags: data.tags || [],
      obtained: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      sortIndex: maxSort + 1,
    };
    await reqToPromise(store.add(item));
    return item;
  },

  async update(id, patch) {
    const t = await tx(['wishlist'], 'readwrite');
    const store = t.objectStore('wishlist');
    const existing = await reqToPromise(store.get(id));
    if (!existing) throw new Error('Item de wishlist introuvable');
    const updated = { ...existing, ...patch, updatedAt: Date.now() };
    await reqToPromise(store.put(updated));
    return updated;
  },

  async remove(id) {
    const t = await tx(['wishlist'], 'readwrite');
    await reqToPromise(t.objectStore('wishlist').delete(id));
  },
};

/* ---------- API : TROUSSE À MATOS ---------- */

const GearAPI = {
  async getAll() {
    const t = await tx(['gearItems']);
    const all = await reqToPromise(t.objectStore('gearItems').getAll());
    return all.sort((a, b) => (b.sortIndex ?? 0) - (a.sortIndex ?? 0)); // plus récent en premier
  },

  async get(id) {
    const t = await tx(['gearItems']);
    return reqToPromise(t.objectStore('gearItems').get(id));
  },

  async create(data) {
    const t = await tx(['gearItems'], 'readwrite');
    const store = t.objectStore('gearItems');
    const all = await reqToPromise(store.getAll());
    const maxSort = all.reduce((m, g) => Math.max(m, g.sortIndex ?? 0), 0);

    const item = {
      id: uid(),
      type: data.type === 'box' ? 'box' : 'simple', // 'simple' | 'box'
      title: data.title.trim(),
      brand: (data.brand || '').trim(),
      image: data.image || null,
      notes: (data.notes || '').trim(),
      categories: data.categories && data.categories.length > 0 ? data.categories : [UNCATEGORIZED_GEAR_CATEGORY],
      medium: data.medium || null,
      units: data.units || [], // [{ id, name, reference, color, status }] — vide si type 'simple'
      createdAt: Date.now(),
      updatedAt: Date.now(),
      sortIndex: maxSort + 1,
    };
    await reqToPromise(store.add(item));
    return item;
  },

  async update(id, patch) {
    const t = await tx(['gearItems'], 'readwrite');
    const store = t.objectStore('gearItems');
    const existing = await reqToPromise(store.get(id));
    if (!existing) throw new Error('Objet de la trousse introuvable');
    const updated = { ...existing, ...patch, updatedAt: Date.now() };
    await reqToPromise(store.put(updated));
    return updated;
  },

  async remove(id) {
    const t = await tx(['gearItems'], 'readwrite');
    await reqToPromise(t.objectStore('gearItems').delete(id));
  },

  async setUnitStatus(itemId, unitId, status) {
    const t = await tx(['gearItems'], 'readwrite');
    const store = t.objectStore('gearItems');
    const existing = await reqToPromise(store.get(itemId));
    if (!existing) throw new Error('Objet de la trousse introuvable');
    const units = existing.units.map(u => u.id === unitId ? { ...u, status } : u);
    const updated = { ...existing, units, updatedAt: Date.now() };
    await reqToPromise(store.put(updated));
    return updated;
  },

  async setUnitColor(itemId, unitId, color) {
    // La couleur réelle d'une unité (choisie via roue chromatique) est
    // réutilisée partout où cette unité est référencée (combos) — sur le
    // même principe que les couleurs d'année pour les pages de livres.
    const t = await tx(['gearItems'], 'readwrite');
    const store = t.objectStore('gearItems');
    const existing = await reqToPromise(store.get(itemId));
    if (!existing) throw new Error('Objet de la trousse introuvable');
    const units = existing.units.map(u => (u.id === unitId && !u.locked) ? { ...u, color } : u);
    const updated = { ...existing, units, updatedAt: Date.now() };
    await reqToPromise(store.put(updated));
    return updated;
  },

  async setUnitLocked(itemId, unitId, locked) {
    // Le cadenas protège une couleur déjà bien réglée d'un clic accidentel
    // sur la pastille (facile d'arriver en cherchant une référence proche
    // dans une longue liste) : tant qu'elle est verrouillée, setUnitColor
    // refuse silencieusement toute modification.
    const t = await tx(['gearItems'], 'readwrite');
    const store = t.objectStore('gearItems');
    const existing = await reqToPromise(store.get(itemId));
    if (!existing) throw new Error('Objet de la trousse introuvable');
    const units = existing.units.map(u => u.id === unitId ? { ...u, locked } : u);
    const updated = { ...existing, units, updatedAt: Date.now() };
    await reqToPromise(store.put(updated));
    return updated;
  },

  async setUnitDetails(itemId, unitId, { name, reference }) {
    const t = await tx(['gearItems'], 'readwrite');
    const store = t.objectStore('gearItems');
    const existing = await reqToPromise(store.get(itemId));
    if (!existing) throw new Error('Objet de la trousse introuvable');
    const units = existing.units.map(u => u.id === unitId ? { ...u, name, reference } : u);
    const updated = { ...existing, units, updatedAt: Date.now() };
    await reqToPromise(store.put(updated));
    return updated;
  },

  async addUnit(itemId, { name, reference, color } = {}) {
    const t = await tx(['gearItems'], 'readwrite');
    const store = t.objectStore('gearItems');
    const existing = await reqToPromise(store.get(itemId));
    if (!existing) throw new Error('Objet de la trousse introuvable');
    const newUnit = {
      id: uid(),
      name: (name || '').trim(),
      reference: (reference || '').trim(),
      color: color || null,
      status: 'ok',
    };
    const units = [...existing.units, newUnit];
    const updated = { ...existing, units, updatedAt: Date.now() };
    await reqToPromise(store.put(updated));
    return updated;
  },

  async removeUnit(itemId, unitId) {
    const t = await tx(['gearItems'], 'readwrite');
    const store = t.objectStore('gearItems');
    const existing = await reqToPromise(store.get(itemId));
    if (!existing) throw new Error('Objet de la trousse introuvable');
    const units = existing.units.filter(u => u.id !== unitId);
    const updated = { ...existing, units, updatedAt: Date.now() };
    await reqToPromise(store.put(updated));
    return updated;
  },

  async reorderUnits(itemId, orderedUnitIds) {
    // Réordonne TOUTES les unités selon la liste complète d'identifiants
    // fournie (utilisé pour le glisser-déposer) — toute unité absente de
    // la liste (ne devrait pas arriver) est conservée à la fin par sécurité.
    const t = await tx(['gearItems'], 'readwrite');
    const store = t.objectStore('gearItems');
    const existing = await reqToPromise(store.get(itemId));
    if (!existing) throw new Error('Objet de la trousse introuvable');
    const byId = new Map(existing.units.map(u => [u.id, u]));
    const units = orderedUnitIds.map(id => byId.get(id)).filter(Boolean);
    for (const u of existing.units) {
      if (!orderedUnitIds.includes(u.id)) units.push(u);
    }
    const updated = { ...existing, units, updatedAt: Date.now() };
    await reqToPromise(store.put(updated));
    return updated;
  },

  async moveUnit(itemId, unitId, direction) {
    // Échange l'unité avec sa voisine immédiate (direction: -1 = monter,
    // +1 = descendre) — utilisé pour les flèches haut/bas, un déplacement
    // simple d'une seule position à la fois.
    const t = await tx(['gearItems'], 'readwrite');
    const store = t.objectStore('gearItems');
    const existing = await reqToPromise(store.get(itemId));
    if (!existing) throw new Error('Objet de la trousse introuvable');
    const units = [...existing.units];
    const index = units.findIndex(u => u.id === unitId);
    const targetIndex = index + direction;
    if (index === -1 || targetIndex < 0 || targetIndex >= units.length) {
      return existing; // déjà en haut/en bas, rien à faire
    }
    [units[index], units[targetIndex]] = [units[targetIndex], units[index]];
    const updated = { ...existing, units, updatedAt: Date.now() };
    await reqToPromise(store.put(updated));
    return updated;
  },

  async setUnitStock(itemId, unitId, stock) {
    // Stock à l'unité, totalement indépendant du statut OK/Manquant/Mort —
    // utile pour repérer les couleurs dont on a plusieurs exemplaires
    // (souvent rachetées en double car elles s'épuisent vite à l'usage).
    const t = await tx(['gearItems'], 'readwrite');
    const store = t.objectStore('gearItems');
    const existing = await reqToPromise(store.get(itemId));
    if (!existing) throw new Error('Objet de la trousse introuvable');
    const clampedStock = Math.max(0, stock);
    const units = existing.units.map(u => u.id === unitId ? { ...u, stock: clampedStock } : u);
    const updated = { ...existing, units, updatedAt: Date.now() };
    await reqToPromise(store.put(updated));
    return updated;
  },
};

/* ---------- API : MÉDIUMS DE MATÉRIEL ---------- */

const GearMediumsAPI = {
  async getAll() {
    const t = await tx(['gearMediums']);
    const all = await reqToPromise(t.objectStore('gearMediums').getAll());
    return all.map(m => m.name).sort((a, b) => a.localeCompare(b, 'fr'));
  },

  async create(name) {
    const clean = name.trim();
    if (!clean) return;
    const t = await tx(['gearMediums'], 'readwrite');
    const store = t.objectStore('gearMediums');
    const existing = await reqToPromise(store.get(clean));
    if (!existing) await reqToPromise(store.put({ name: clean }));
  },

  async delete(name) {
    // Contrairement aux catégories, un médium n'a pas de panier par défaut :
    // le supprimer retire juste l'association sur les objets concernés,
    // qui repassent à "aucun médium" plutôt que vers une valeur de repli.
    const t = await tx(['gearItems', 'gearMediums'], 'readwrite');
    const itemStore = t.objectStore('gearItems');
    const items = await reqToPromise(itemStore.getAll());
    for (const item of items) {
      if (item.medium === name) {
        await reqToPromise(itemStore.put({ ...item, medium: null }));
      }
    }
    await reqToPromise(t.objectStore('gearMediums').delete(name));
  },
};

/* ---------- API : TYPES DE LIVRE (personnalisables) ---------- */

const BookTypesAPI = {
  async getAll() {
    // Toujours triés par sortIndex (ordre de création), JAMAIS
    // alphabétiquement — c'est cet ordre précis qui détermine la position
    // des étagères dans la bibliothèque et des onglets dans la galerie.
    const t = await tx(['bookTypes']);
    const all = await reqToPromise(t.objectStore('bookTypes').getAll());
    return all.sort((a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0));
  },

  async create(name) {
    const clean = name.trim();
    if (!clean) return null;
    const t = await tx(['bookTypes'], 'readwrite');
    const store = t.objectStore('bookTypes');
    const all = await reqToPromise(store.getAll());
    const existing = all.find(bt => bt.name.toLowerCase() === clean.toLowerCase());
    if (existing) return existing;
    const maxSort = all.reduce((m, bt) => Math.max(m, bt.sortIndex ?? 0), 0);
    const bookType = { id: uid(), name: clean, sortIndex: maxSort + 1 };
    await reqToPromise(store.add(bookType));
    return bookType;
  },

  async createWithId(id, name) {
    const t = await tx(['bookTypes'], 'readwrite');
    const store = t.objectStore('bookTypes');
    const all = await reqToPromise(store.getAll());
    const maxSort = all.reduce((m, bt) => Math.max(m, bt.sortIndex ?? 0), 0);
    const bookType = { id, name: name.trim(), sortIndex: maxSort + 1 };
    await reqToPromise(store.put(bookType));
    return bookType;
  },

  async delete(bookTypeId) {
    // Supprimer un type retire l'assignation sur tous les livres concernés
    // (ils repassent "sans type", donc dans l'étagère "Livre de coloriage")
    // plutôt que de laisser une référence orpheline.
    const t = await tx(['books', 'bookTypes'], 'readwrite');
    const bookStore = t.objectStore('books');
    const books = await reqToPromise(bookStore.getAll());
    for (const book of books) {
      if (book.bookType === bookTypeId) {
        await reqToPromise(bookStore.put({ ...book, bookType: null, updatedAt: Date.now() }));
      }
    }
    await reqToPromise(t.objectStore('bookTypes').delete(bookTypeId));
  },
};

/* ---------- API : COMBOS DE COULEURS ---------- */

const UNCATEGORIZED_COMBO_CATEGORY = 'Sans catégorie';

const ComboAPI = {
  async getAll() {
    const t = await tx(['combos']);
    const all = await reqToPromise(t.objectStore('combos').getAll());
    return all.sort((a, b) => (b.sortIndex ?? 0) - (a.sortIndex ?? 0)); // plus récent en premier
  },

  async get(id) {
    const t = await tx(['combos']);
    return reqToPromise(t.objectStore('combos').get(id));
  },

  async create(data) {
    const t = await tx(['combos'], 'readwrite');
    const store = t.objectStore('combos');
    const all = await reqToPromise(store.getAll());
    const maxSort = all.reduce((m, c) => Math.max(m, c.sortIndex ?? 0), 0);

    const combo = {
      id: uid(),
      title: (data.title || '').trim(),
      images: data.images || [], // au moins une image, vérifié côté UI avant l'appel
      categories: data.categories && data.categories.length > 0 ? data.categories : [UNCATEGORIZED_COMBO_CATEGORY],
      colorRefs: data.colorRefs || [], // [{ gearItemId, unitId }]
      createdAt: Date.now(),
      updatedAt: Date.now(),
      sortIndex: maxSort + 1,
    };
    await reqToPromise(store.add(combo));
    return combo;
  },

  async update(id, patch) {
    const t = await tx(['combos'], 'readwrite');
    const store = t.objectStore('combos');
    const existing = await reqToPromise(store.get(id));
    if (!existing) throw new Error('Combo introuvable');
    const updated = { ...existing, ...patch, updatedAt: Date.now() };
    await reqToPromise(store.put(updated));
    return updated;
  },

  async remove(id) {
    const t = await tx(['combos'], 'readwrite');
    await reqToPromise(t.objectStore('combos').delete(id));
  },
};

/* ---------- API : CATÉGORIES DE COMBO ---------- */

const ComboCategoriesAPI = {
  async getAll() {
    const t = await tx(['comboCategories']);
    const all = await reqToPromise(t.objectStore('comboCategories').getAll());
    const names = all.map(c => c.name);
    if (!names.includes(UNCATEGORIZED_COMBO_CATEGORY)) names.unshift(UNCATEGORIZED_COMBO_CATEGORY);
    return names.sort((a, b) => {
      if (a === UNCATEGORIZED_COMBO_CATEGORY) return 1;
      if (b === UNCATEGORIZED_COMBO_CATEGORY) return -1;
      return a.localeCompare(b, 'fr');
    });
  },

  async create(name) {
    const clean = name.trim();
    if (!clean) return;
    const t = await tx(['comboCategories'], 'readwrite');
    const store = t.objectStore('comboCategories');
    const existing = await reqToPromise(store.get(clean));
    if (!existing) await reqToPromise(store.put({ name: clean }));
  },

  async delete(name) {
    if (name === UNCATEGORIZED_COMBO_CATEGORY) {
      throw new Error('"Sans catégorie" ne peut pas être supprimée : c\'est le panier par défaut.');
    }
    const t = await tx(['combos', 'comboCategories'], 'readwrite');
    const comboStore = t.objectStore('combos');
    const combos = await reqToPromise(comboStore.getAll());
    for (const combo of combos) {
      if ((combo.categories || []).includes(name)) {
        const remaining = combo.categories.filter(c => c !== name);
        await reqToPromise(comboStore.put({ ...combo, categories: remaining.length > 0 ? remaining : [UNCATEGORIZED_COMBO_CATEGORY] }));
      }
    }
    await reqToPromise(t.objectStore('comboCategories').delete(name));
  },
};

/* ---------- API : FICHES PERSONNAGE ---------- */

const CharacterAPI = {
  async getAll() {
    const t = await tx(['characters']);
    const all = await reqToPromise(t.objectStore('characters').getAll());
    return all.sort((a, b) => (b.sortIndex ?? 0) - (a.sortIndex ?? 0)); // plus récent en premier
  },

  async get(id) {
    const t = await tx(['characters']);
    return reqToPromise(t.objectStore('characters').get(id));
  },

  async create(data) {
    const t = await tx(['characters'], 'readwrite');
    const store = t.objectStore('characters');
    const all = await reqToPromise(store.getAll());
    const maxSort = all.reduce((m, c) => Math.max(m, c.sortIndex ?? 0), 0);

    const character = {
      id: uid(),
      title: data.title.trim(),
      image: data.image,
      markers: data.markers || [],
      categories: data.categories || [UNCATEGORIZED_CATEGORY],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      sortIndex: maxSort + 1,
    };
    await reqToPromise(store.add(character));
    return character;
  },

  async update(id, patch) {
    const t = await tx(['characters'], 'readwrite');
    const store = t.objectStore('characters');
    const existing = await reqToPromise(store.get(id));
    if (!existing) throw new Error('Fiche personnage introuvable');
    const updated = { ...existing, ...patch, updatedAt: Date.now() };
    await reqToPromise(store.put(updated));
    return updated;
  },

  async remove(id) {
    const t = await tx(['characters'], 'readwrite');
    await reqToPromise(t.objectStore('characters').delete(id));
  },
};

/* ---------- API : CATÉGORIES DE MATÉRIEL ---------- */

const GearCategoriesAPI = {
  async getAll() {
    const t = await tx(['gearCategories']);
    const all = await reqToPromise(t.objectStore('gearCategories').getAll());
    const names = all.map(c => c.name);
    if (!names.includes(UNCATEGORIZED_GEAR_CATEGORY)) names.unshift(UNCATEGORIZED_GEAR_CATEGORY);
    return names.sort((a, b) => {
      if (a === UNCATEGORIZED_GEAR_CATEGORY) return 1;
      if (b === UNCATEGORIZED_GEAR_CATEGORY) return -1;
      return a.localeCompare(b, 'fr');
    });
  },

  async create(name) {
    const clean = name.trim();
    if (!clean) return;
    const t = await tx(['gearCategories'], 'readwrite');
    const store = t.objectStore('gearCategories');
    const existing = await reqToPromise(store.get(clean));
    if (!existing) await reqToPromise(store.put({ name: clean }));
  },

  async delete(name) {
    if (name === UNCATEGORIZED_GEAR_CATEGORY) {
      throw new Error('"Sans catégorie" ne peut pas être supprimée : c\'est le panier par défaut.');
    }
    const t = await tx(['gearItems', 'gearCategories'], 'readwrite');
    const itemStore = t.objectStore('gearItems');
    const items = await reqToPromise(itemStore.getAll());
    for (const item of items) {
      if ((item.categories || []).includes(name)) {
        const remaining = item.categories.filter(c => c !== name);
        await reqToPromise(itemStore.put({ ...item, categories: remaining.length > 0 ? remaining : [UNCATEGORIZED_GEAR_CATEGORY] }));
      }
    }
    await reqToPromise(t.objectStore('gearCategories').delete(name));
  },
};

/* ---------- API : META (préférences) ---------- */

const MetaAPI = {
  async get(key, fallback = null) {
    const t = await tx(['meta']);
    const result = await reqToPromise(t.objectStore('meta').get(key));
    return result ? result.value : fallback;
  },
  async set(key, value) {
    const t = await tx(['meta'], 'readwrite');
    await reqToPromise(t.objectStore('meta').put({ key, value }));
  },
};

/* ---------- EXPORT / IMPORT (préparé pour l'étape 5) ---------- */

/* ---------- API : PALETTES ---------- */

const PalettesAPI = {
  async getAll() {
    const t = await tx(['palettes']);
    return reqToPromise(t.objectStore('palettes').getAll());
  },
  async create(data) {
    const t = await tx(['palettes'], 'readwrite');
    const item = {
      id: uid(),
      name: data.name.trim(),
      photo: data.photo || null,
      notes: (data.notes || '').trim(),
      categories: data.categories || [UNCATEGORIZED_CATEGORY],
      linkedPages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await reqToPromise(t.objectStore('palettes').add(item));
    return item;
  },
  async update(id, patch) {
    const t = await tx(['palettes'], 'readwrite');
    const store = t.objectStore('palettes');
    const existing = await reqToPromise(store.get(id));
    if (!existing) throw new Error('Palette introuvable');
    const updated = { ...existing, ...patch, updatedAt: Date.now() };
    await reqToPromise(store.put(updated));
    return updated;
  },
  async remove(id) {
    const t = await tx(['palettes'], 'readwrite');
    await reqToPromise(t.objectStore('palettes').delete(id));
  },
};

/* ---------- API : TECHNIQUES ---------- */

const TechniquesAPI = {
  async getAll() {
    const t = await tx(['techniques']);
    return reqToPromise(t.objectStore('techniques').getAll());
  },
  async create(data) {
    const t = await tx(['techniques'], 'readwrite');
    const item = {
      id: uid(),
      type: data.type === 'note' ? 'note' : 'link',
      title: data.title.trim(),
      url: (data.url || '').trim() || null,
      content: (data.content || '').trim() || null,
      categories: data.categories || [UNCATEGORIZED_CATEGORY],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await reqToPromise(t.objectStore('techniques').add(item));
    return item;
  },
  async update(id, patch) {
    const t = await tx(['techniques'], 'readwrite');
    const store = t.objectStore('techniques');
    const existing = await reqToPromise(store.get(id));
    if (!existing) throw new Error('Technique introuvable');
    const updated = { ...existing, ...patch, updatedAt: Date.now() };
    await reqToPromise(store.put(updated));
    return updated;
  },
  async remove(id) {
    const t = await tx(['techniques'], 'readwrite');
    await reqToPromise(t.objectStore('techniques').delete(id));
  },
};

/* ---------- APIs DE CATÉGORIES GÉNÉRIQUES ---------- */
// Même pattern que ComboCategoriesAPI — réutilisé pour Personnages, Palettes, Techniques.

function makeCategoriesAPI(storeName, itemsStoreName) {
  return {
    async getAll() {
      const t = await tx([storeName]);
      const all = await reqToPromise(t.objectStore(storeName).getAll());
      const names = all.map(c => c.name);
      if (!names.includes(UNCATEGORIZED_CATEGORY)) names.unshift(UNCATEGORIZED_CATEGORY);
      return names.sort((a, b) => {
        if (a === UNCATEGORIZED_CATEGORY) return 1;
        if (b === UNCATEGORIZED_CATEGORY) return -1;
        return a.localeCompare(b, 'fr');
      });
    },
    async create(name) {
      const clean = name.trim();
      if (!clean || clean === UNCATEGORIZED_CATEGORY) return;
      const t = await tx([storeName], 'readwrite');
      const store = t.objectStore(storeName);
      const existing = await reqToPromise(store.get(clean));
      if (!existing) await reqToPromise(store.put({ name: clean }));
    },
    async delete(name) {
      if (name === UNCATEGORIZED_CATEGORY) throw new Error('"Sans catégorie" ne peut pas être supprimée.');
      const t = await tx([itemsStoreName, storeName], 'readwrite');
      const itemStore = t.objectStore(itemsStoreName);
      const items = await reqToPromise(itemStore.getAll());
      for (const item of items) {
        if ((item.categories || []).includes(name)) {
          const remaining = item.categories.filter(c => c !== name);
          await reqToPromise(itemStore.put({ ...item, categories: remaining.length > 0 ? remaining : [UNCATEGORIZED_CATEGORY] }));
        }
      }
      await reqToPromise(t.objectStore(storeName).delete(name));
    },
  };
}

const CharacterCategoriesAPI = makeCategoriesAPI('characterCategories', 'characters');
const PaletteCategoriesAPI   = makeCategoriesAPI('paletteCategories',   'palettes');
const TechniqueCategoriesAPI = makeCategoriesAPI('techniqueCategories',  'techniques');

/* ---------- API : COLOCOPINES ---------- */

const ColocopinesAPI = {
  async getAll() {
    const db = await openDB();
    return new Promise((res, rej) => {
      const t = db.transaction(['colocopines'], 'readonly');
      const req = t.objectStore('colocopines').getAll();
      req.onsuccess = () => {
        const all = req.result;
        all.sort((a, b) => (a.sortIndex ?? 999) - (b.sortIndex ?? 999));
        res(all);
      };
      req.onerror = () => rej(req.error);
    });
  },
  async create(data) {
    const db = await openDB();
    const item = {
      id: uid(),
      pseudo: data.pseudo.trim(),
      avatar: data.avatar || null,
      instagram: (data.instagram || '').trim(),
      // sharedBooks : [{ bookId, trackerPhoto }]
      sharedBooks: data.sharedBooks || [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    return new Promise((res, rej) => {
      const t = db.transaction(['colocopines'], 'readwrite');
      const req = t.objectStore('colocopines').add(item);
      req.onsuccess = () => res(item);
      req.onerror = () => rej(req.error);
    });
  },
  async update(id, patch) {
    const db = await openDB();
    return new Promise((res, rej) => {
      const t = db.transaction(['colocopines'], 'readwrite');
      const store = t.objectStore('colocopines');
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const updated = { ...getReq.result, ...patch, updatedAt: Date.now() };
        const putReq = store.put(updated);
        putReq.onsuccess = () => res(updated);
        putReq.onerror = () => rej(putReq.error);
      };
      getReq.onerror = () => rej(getReq.error);
    });
  },
  async setSharedBookCheckedPages(colocopineId, bookId, checkedPages) {
    const db = await openDB();
    return new Promise((res, rej) => {
      const t = db.transaction(['colocopines'], 'readwrite');
      const store = t.objectStore('colocopines');
      const getReq = store.get(colocopineId);
      getReq.onsuccess = () => {
        const colo = getReq.result;
        if (!colo) { rej(new Error('Colocopine introuvable')); return; }
        const sharedBooks = (colo.sharedBooks || []).map(sb =>
          sb.bookId === bookId ? { ...sb, checkedPages } : sb
        );
        const updated = { ...colo, sharedBooks, updatedAt: Date.now() };
        const putReq = store.put(updated);
        putReq.onsuccess = () => res(updated);
        putReq.onerror = () => rej(putReq.error);
      };
      getReq.onerror = () => rej(getReq.error);
    });
  },

  async remove(id) {
    const db = await openDB();
    return new Promise((res, rej) => {
      const t = db.transaction(['colocopines'], 'readwrite');
      const req = t.objectStore('colocopines').delete(id);
      req.onsuccess = () => res();
      req.onerror = () => rej(req.error);
    });
  },
};

const BackupAPI = {
  async exportAll() {
    const [books, pageEntries, years, tags, tagCategories, challenges, wishlist, gearItems, gearCategories, gearMediums, combos, comboCategories, characters, bookTypes, palettes, techniques, characterCategories, paletteCategories, techniqueCategories, missions, colocopines] = await Promise.all([
      BooksAPI.getAll(),
      PagesAPI.getAll(),
      YearsAPI.getAll(),
      TagsAPI.getAllWithCategories(),
      TagCategoriesAPI.getAll(),
      ChallengesAPI.getAll(),
      WishlistAPI.getAll(),
      GearAPI.getAll(),
      GearCategoriesAPI.getAll(),
      GearMediumsAPI.getAll(),
      ComboAPI.getAll(),
      ComboCategoriesAPI.getAll(),
      CharacterAPI.getAll(),
      BookTypesAPI.getAll(),
      PalettesAPI.getAll(),
      TechniquesAPI.getAll(),
      CharacterCategoriesAPI.getAll(),
      PaletteCategoriesAPI.getAll(),
      TechniqueCategoriesAPI.getAll(),
      getMissions(),
      ColocopinesAPI.getAll(),
    ]);
    const metaStore = (await tx(['meta'])).objectStore('meta');
    const meta = await reqToPromise(metaStore.getAll());

    return {
      schemaVersion: DB_VERSION,
      exportedAt: new Date().toISOString(),
      books,
      pageEntries,
      years,
      tags,
      tagCategories,
      challenges,
      wishlist,
      gearItems,
      gearCategories,
      gearMediums,
      combos,
      comboCategories,
      characters,
      bookTypes,
      palettes,
      techniques,
      characterCategories,
      paletteCategories,
      techniqueCategories,
      missions,
      colocopines,
      meta,
    };
  },

  async importAll(data) {
    // Remplacement total : on valide d'abord la structure minimale attendue,
    // puis on vide chaque store avant de le repeupler avec les données
    // du fichier. Une seule grande transaction garantit que l'opération
    // est atomique : soit tout est remplacé, soit rien ne change en cas d'erreur.
    if (!data || typeof data !== 'object') {
      throw new Error('Fichier de sauvegarde invalide : format inattendu.');
    }
    const requiredArrays = ['books', 'pageEntries', 'years', 'tags', 'challenges'];
    for (const key of requiredArrays) {
      if (!Array.isArray(data[key])) {
        throw new Error(`Fichier de sauvegarde invalide : la section "${key}" est manquante ou mal formée.`);
      }
    }

    const storeNames = ['books', 'pageEntries', 'years', 'tags', 'tagCategories', 'challenges', 'wishlist', 'gearItems', 'gearCategories', 'gearMediums', 'combos', 'comboCategories', 'characters', 'bookTypes', 'palettes', 'techniques', 'characterCategories', 'paletteCategories', 'techniqueCategories', 'missions', 'colocopines', 'meta'];
    const t = await tx(storeNames, 'readwrite');

    // Attend la fin RÉELLE de la transaction (commit), pas seulement que
    // chaque requête individuelle ait réussi : sans ça, un refresh des
    // données juste après l'import peut lire une base pas encore à jour.
    const transactionDone = new Promise((resolve, reject) => {
      t.oncomplete = () => resolve();
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error || new Error('Transaction annulée'));
    });

    for (const name of storeNames) {
      await reqToPromise(t.objectStore(name).clear());
    }

    const put = (storeName, records) => Promise.all(
      records.map(r => reqToPromise(t.objectStore(storeName).put(r)))
    );

    // IMPORTANT : on lance tous les puts SANS await intermédiaire pour éviter
    // que la transaction se ferme automatiquement entre deux opérations
    // (comportement strict d'Opera/Brave sur les transactions IndexedDB).
    const tagRecords = data.tags.map(t => {
      if (typeof t === 'string') return { name: t, categories: [UNCATEGORIZED_TAG_CATEGORY] };
      return { ...t, categories: t.categories && t.categories.length > 0 ? t.categories : [UNCATEGORIZED_TAG_CATEGORY] };
    });
    const categoryRecords = Array.isArray(data.tagCategories)
      ? data.tagCategories.filter(c => c !== UNCATEGORIZED_TAG_CATEGORY).map(c => typeof c === 'string' ? { name: c } : c)
      : [];
    const gearCategoryRecords = Array.isArray(data.gearCategories)
      ? data.gearCategories.filter(c => c !== UNCATEGORIZED_GEAR_CATEGORY).map(c => typeof c === 'string' ? { name: c } : c)
      : [];
    const gearMediumRecords = Array.isArray(data.gearMediums)
      ? data.gearMediums.map(m => typeof m === 'string' ? { name: m } : m)
      : [];
    const comboCategoryRecords = Array.isArray(data.comboCategories)
      ? data.comboCategories.filter(c => c !== UNCATEGORIZED_COMBO_CATEGORY).map(c => typeof c === 'string' ? { name: c } : c)
      : [];

    const allPuts = [
      put('books', data.books),
      put('pageEntries', data.pageEntries),
      put('years', data.years),
      put('tags', tagRecords),
      put('tagCategories', categoryRecords),
      put('challenges', data.challenges),
      data.wishlist ? put('wishlist', data.wishlist) : Promise.resolve(),
      data.gearItems ? put('gearItems', data.gearItems) : Promise.resolve(),
      put('gearCategories', gearCategoryRecords),
      put('gearMediums', gearMediumRecords),
      data.combos ? put('combos', data.combos) : Promise.resolve(),
      put('comboCategories', comboCategoryRecords),
      data.characters ? put('characters', data.characters) : Promise.resolve(),
      data.bookTypes ? put('bookTypes', data.bookTypes) : Promise.resolve(),
      data.palettes ? put('palettes', data.palettes) : Promise.resolve(),
      data.techniques ? put('techniques', data.techniques) : Promise.resolve(),
      data.characterCategories ? put('characterCategories', data.characterCategories) : Promise.resolve(),
      data.paletteCategories ? put('paletteCategories', data.paletteCategories) : Promise.resolve(),
      data.techniqueCategories ? put('techniqueCategories', data.techniqueCategories) : Promise.resolve(),
      data.missions ? put('missions', data.missions) : Promise.resolve(),
      data.colocopines ? put('colocopines', data.colocopines) : Promise.resolve(),
      data.meta ? put('meta', data.meta) : Promise.resolve(),
    ];

    await Promise.all(allPuts);

    await transactionDone;

    return {
      booksCount: data.books.length,
      pageEntriesCount: data.pageEntries.length,
      challengesCount: data.challenges.length,
    };
  },
};
