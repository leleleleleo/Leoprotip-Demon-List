import {
    isConfigured, getToken, setToken, login,
    listSubmissions, setStatus, deleteSubmission,
} from '../supabase.js';
import Btn from '../components/Btn.js';
import Spinner from '../components/Spinner.js';
import { setPhoneViewport } from '../util.js';

const STATUS = { pending: 'Pendiente', approved: 'Aprobado', rejected: 'Rechazado' };

export default {
    components: { Btn, Spinner },
    template: `
        <main class="page-submit page-admin">
          <div class="wrap">
            <h1>Panel del staff</h1>
            <p v-if="!configured" class="note error">Falta configurar js/config.js.</p>
            <form v-else-if="!authed" @submit.prevent="onLogin">
                <label>Correo<input v-model.trim="email" type="email" required autocomplete="username"></label>
                <label>Contraseña<input v-model="password" type="password" required autocomplete="current-password"></label>
                <p v-if="error" class="note error">{{ error }}</p>
                <Btn @click.native.prevent="onLogin">Entrar</Btn>
            </form>
            <template v-else>
                <div class="toolbar">
                    <label class="inline">Mostrar
                        <select v-model="filter">
                            <option value="all">Todos</option>
                            <option value="pending">Pendientes</option>
                            <option value="approved">Aprobados</option>
                            <option value="rejected">Rechazados</option>
                        </select>
                    </label>
                    <Btn @click.native.prevent="load">Actualizar</Btn>
                    <Btn @click.native.prevent="logout">Salir</Btn>
                </div>
                <p v-if="error" class="note error">{{ error }}</p>
                <Spinner v-if="loading"></Spinner>
                <p v-else-if="shown.length === 0">No hay envíos.</p>
                <article v-for="s in shown" :key="s.id" class="submission" :class="s.status">
                    <header>
                        <strong>{{ s.nickname }}</strong> · {{ s.progress }}% en <strong>{{ s.level_name }}</strong> (ID {{ s.level_id }})
                        <span class="badge">{{ STATUS[s.status] }}</span>
                    </header>
                    <p class="meta">{{ new Date(s.created_at).toLocaleString() }}</p>
                    <p><a :href="s.video" target="_blank" rel="noopener">Video</a>
                        <template v-if="s.channel"> · <a :href="s.channel" target="_blank" rel="noopener">Canal</a></template>
                        <template v-if="s.hz"> · {{ s.hz }} FPS</template>
                        <template v-if="s.mobile"> · Móvil</template></p>
                    <p v-if="s.password || s.creators || s.verifier || s.publisher" class="meta">
                        Nivel nuevo —
                        <template v-if="s.publisher">publisher: {{ s.publisher }}; </template>
                        <template v-if="s.creators">creadores: {{ s.creators }}; </template>
                        <template v-if="s.verifier">verificador: {{ s.verifier }}; </template>
                        <template v-if="s.password">password: {{ s.password }}</template>
                    </p>
                    <div class="actions">
                        <Btn @click.native.prevent="copy(recordJson(s))">Copiar récord JSON</Btn>
                        <Btn v-if="s.verifier || s.publisher" @click.native.prevent="copy(levelJson(s))">Copiar nivel JSON</Btn>
                        <Btn v-if="s.status !== 'approved'" @click.native.prevent="mark(s, 'approved')">Aprobar</Btn>
                        <Btn v-if="s.status !== 'rejected'" @click.native.prevent="mark(s, 'rejected')">Rechazar</Btn>
                        <Btn @click.native.prevent="remove(s)">Borrar</Btn>
                    </div>
                </article>
            </template>
          </div>
        </main>
    `,
    data: () => ({
        configured: isConfigured(),
        authed: !!getToken(),
        email: '', password: '', error: '',
        items: [], loading: false, filter: 'pending',
        STATUS,
    }),
    computed: {
        shown() {
            return this.filter === 'all' ? this.items : this.items.filter((s) => s.status === this.filter);
        },
    },
    mounted() {
        setPhoneViewport(true);
        if (this.authed) this.load();
    },
    unmounted() { setPhoneViewport(false); },
    methods: {
        async onLogin() {
            this.error = '';
            try {
                await login(this.email, this.password);
                this.authed = true;
                this.password = '';
                await this.load();
            } catch {
                this.error = 'Correo o contraseña incorrectos.';
            }
        },
        logout() {
            setToken(null);
            this.authed = false;
            this.items = [];
        },
        async load() {
            this.loading = true;
            this.error = '';
            try {
                this.items = await listSubmissions();
            } catch (e) {
                if (e.status === 401 || e.status === 403) {
                    this.logout();
                    this.error = 'Tu sesión expiró. Entra de nuevo.';
                } else {
                    this.error = 'No se pudieron cargar los envíos.';
                }
            } finally {
                this.loading = false;
            }
        },
        async act(fn) {
            this.error = '';
            try { await fn(); await this.load(); } catch { this.error = 'La acción falló. Intenta de nuevo.'; }
        },
        mark(s, status) { return this.act(() => setStatus(s.id, status)); },
        remove(s) {
            if (!window.confirm(`¿Borrar el envío de ${s.nickname}?`)) return;
            return this.act(() => deleteSubmission(s.id));
        },
        recordJson(s) {
            const r = { user: s.nickname, link: s.video, percent: s.progress };
            if (s.hz) r.hz = s.hz;
            if (s.mobile) r.mobile = true;
            return JSON.stringify(r, null, 4);
        },
        levelJson(s) {
            const creators = (s.creators || '').split(/\s*[,;&\/]\s*|\s+y\s+/i).map((x) => x.trim()).filter(Boolean);
            const q = JSON.stringify;
            // Written by hand so "creators" stays on a single line
            return [
                '{',
                `    "id": ${Number(s.level_id)},`,
                `    "name": ${q(s.level_name)},`,
                `    "author": ${q(s.publisher || '')},`,
                `    "creators": [${creators.map((c) => q(c)).join(', ')}],`,
                `    "verifier": ${q(s.verifier || s.nickname)},`,
                `    "verification": ${q(s.video)},`,
                `    "percentToQualify": 0,`,
                `    "password": ${q(s.password || '')},`,
                `    "records": []`,
                '}',
            ].join('\n');
        },
        async copy(text) {
            try {
                await navigator.clipboard.writeText(text);
            } catch {
                window.prompt('Copia el texto:', text);
            }
        },
    },
};
