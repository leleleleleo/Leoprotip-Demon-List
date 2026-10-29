import { isConfigured, submitRecord, listPending } from '../supabase.js';
import Btn from '../components/Btn.js';
import { setPhoneViewport } from '../util.js';
import { fetchList } from '../content.js';

const norm = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');

// Same checks the staff JSON tool uses
function videoIssue(u) {
    if (!/^https?:\/\//i.test(u)) return 'El link del video debe empezar con https://';
    if (/youtube\.com\/(shorts|live)\//i.test(u)) return 'Usa un link normal de YouTube (no Shorts ni en vivo).';
    if (!/(youtu\.be\/|\/v\/|\/u\/\w\/|embed\/|watch\?v=)[^#&?]+/i.test(u)) {
        return 'El link no parece de YouTube. Debe ser youtube.com/watch?v=… o youtu.be/…';
    }
    return '';
}

export default {
    components: { Btn },
    template: `
        <main class="page-submit">
          <div class="wrap wide">
            <h1>Enviar récord</h1>
            <div class="cols">
              <section class="form-col">
                <p v-if="!configured" class="note error">El formulario todavía no está configurado (falta js/config.js).</p>
                <template v-else-if="sent">
                    <p class="note ok">¡Enviado! El staff lo revisará pronto. Gracias.</p>
                    <Btn @click.native.prevent="again">Enviar otro</Btn>
                </template>
                <form v-else @submit.prevent="onSubmit">
                    <label>Nickname * <small>(nombre del jugador)</small><input v-model.trim="f.nickname" maxlength="60" required></label>
                    <label>Progreso * <small>(porcentaje)</small><input v-model.number="f.progress" type="number" min="1" max="100" required></label>
                    <label>Nombre del nivel *<input v-model.trim="f.level_name" maxlength="100" required></label>
                    <label>Id del nivel *<input v-model.trim="f.level_id" inputmode="numeric" pattern="[0-9]{1,12}" required></label>
                    <label>Hz * <small>(los que usaste, ej. 60, 120, 240)</small><input v-model.number="f.hz" type="number" min="1" max="1000" inputmode="numeric" required></label>
                    <label>¿Móvil? <small>(sí/no)</small>
                        <select v-model="f.mobile">
                            <option :value="false">No</option>
                            <option :value="true">Sí</option>
                        </select>
                    </label>
                    <label>Link del video de YT * <small>(link normal, no Shorts ni en vivo)</small><input v-model.trim="f.video" type="url" maxlength="300" required placeholder="https://youtube.com/watch?v=..."></label>
                    <p v-if="existing" class="note ok">Este nivel ya está en {{ existing.unrated ? 'la lista Sin rate' : 'la lista' }} (#{{ existing.rank }}, {{ existing.name }}). Tu récord se agregará a ese nivel.</p>
                    <details :class="{ locked: !canNew }" :open="canNew && showNew">
                        <summary @click.prevent="toggleNew">Solo si es un nivel nuevo para la lista<span v-if="existing"> (este nivel ya está en la lista)</span><span v-else-if="!canNew"> (necesitas 100% de progreso)</span></summary>
                        <label>Password <small>(si no tiene, dejalo en blanco)</small><input v-model.trim="f.password" maxlength="40"></label>
                        <label>Creadores del nivel <small>(separados por coma)</small><input v-model.trim="f.creators" maxlength="200"></label>
                        <label>Verificador <small>(si eres el primero, pon tu nickname)</small><input v-model.trim="f.verifier" maxlength="60"></label>
                        <label>Publisher <small>(el que sale normal en GD)</small><input v-model.trim="f.publisher" maxlength="60"></label>
                    </details>
                    <input v-model="trap" class="trap" tabindex="-1" autocomplete="off" aria-hidden="true">
                    <p v-if="error" class="note error">{{ error }}</p>
                    <Btn :disabled="busy" @click.native.prevent="onSubmit">{{ busy ? 'Enviando…' : 'Enviar' }}</Btn>
                </form>
              </section>
              <aside class="pending-col">
                <h2>Pendientes de revisión</h2>
                <p v-if="pendingError" class="meta">No se pudo cargar la lista.</p>
                <p v-else-if="pending === null" class="meta">Cargando…</p>
                <p v-else-if="pending.length === 0" class="meta">No hay envíos pendientes.</p>
                <ul v-else class="pending-list">
                    <li v-for="(p, i) in pending" :key="i">
                        <strong>{{ p.nickname }}</strong>
                        <span>{{ p.progress }}% · {{ p.level_name }}</span>
                    </li>
                </ul>
              </aside>
            </div>
          </div>
        </main>
    `,
    data: () => ({
        configured: isConfigured(),
        sent: false,
        busy: false,
        error: '',
        trap: '',
        pending: null,
        pendingError: false,
        showNew: false,
        known: [],
        f: {
            nickname: '', progress: null, level_name: '', level_id: '', hz: null, mobile: false,
            video: '', password: '', creators: '', verifier: '', publisher: '',
        },
    }),
    computed: {
        // The "new level" section is only for players who beat the level
        // The level typed in the form, if it is already in the main or unrated list
        existing() {
            const id = String(this.f.level_id || '').trim();
            const name = norm(this.f.level_name);
            if (!id && !name) return null;
            return this.known.find((l) => (id && l.id === id) || (name && l.key === name)) || null;
        },
        canNew() {
            return this.f.progress === 100 && !this.existing;
        },
    },
    watch: {
        canNew(ok) {
            if (!ok) {
                this.showNew = false;
                this.f.password = '';
                this.f.creators = '';
                this.f.verifier = '';
                this.f.publisher = '';
            }
        },
        'f.progress'(v) {
            if (v !== 100) {
                this.showNew = false;
                this.f.password = '';
                this.f.creators = '';
                this.f.verifier = '';
                this.f.publisher = '';
            }
        },
    },
    mounted() {
        setPhoneViewport(true);
        this.loadPending();
        this.loadKnown();
    },
    unmounted() { setPhoneViewport(false); },
    methods: {
        // Names and ids of every level already on the site, to detect repeats
        async loadKnown() {
            try {
                const [main, unrated] = await Promise.all([
                    fetchList('data'),
                    fetchList('data/unrated'),
                ]);
                const out = [];
                [[main, false], [unrated, true]].forEach(([list, isUnrated]) => {
                    (list || []).forEach(([lvl], i) => {
                        if (!lvl) return;
                        out.push({
                            id: String(lvl.id),
                            key: norm(lvl.name),
                            name: lvl.name,
                            rank: i + 1,
                            unrated: isUnrated,
                        });
                    });
                });
                this.known = out;
            } catch {
                this.known = [];
            }
        },
        async loadPending() {
            if (!this.configured) return;
            try {
                this.pending = await listPending();
                this.pendingError = false;
            } catch {
                this.pendingError = true;
            }
        },
        toggleNew() {
            if (this.canNew) this.showNew = !this.showNew;
        },
        again() {
            this.sent = false;
            this.error = '';
        },
        async onSubmit() {
            if (this.busy) return;
            this.error = '';
            if (this.trap) { this.sent = true; return; } // bot: se ignora en silencio
            const f = this.f;
            if (!f.nickname || !f.level_name || !/^\d{1,12}$/.test(f.level_id) ||
                !(f.progress >= 1 && f.progress <= 100) || !(f.hz >= 1 && f.hz <= 1000)) {
                this.error = 'Revisa los campos obligatorios (*).';
                return;
            }
            const issue = videoIssue(f.video);
            if (issue) { this.error = issue; return; }

            const row = {};
            for (const [k, v] of Object.entries(f)) {
                if (v !== '' && v !== null) row[k] = v;
            }
            row.level_id = String(row.level_id);
            this.busy = true;
            try {
                await submitRecord(row);
                this.sent = true;
                this.showNew = false;
                this.f = {
                    nickname: '', progress: null, level_name: '', level_id: '', hz: null, mobile: false,
                    video: '', password: '', creators: '', verifier: '', publisher: '',
                };
                this.loadPending();
            } catch {
                this.error = 'No se pudo enviar. Revisa los datos e inténtalo de nuevo.';
            } finally {
                this.busy = false;
            }
        },
    },
};
