import { isConfigured, submitRecord } from '../supabase.js';
import Btn from '../components/Btn.js';

export default {
    components: { Btn },
    template: `
        <main class="page-submit">
            <h1>Enviar récord</h1>
            <p v-if="!configured" class="note error">El formulario todavía no está configurado (falta js/config.js).</p>
            <p v-else-if="sent" class="note ok">¡Enviado! El staff lo revisará pronto. Gracias.</p>
            <form v-else @submit.prevent="onSubmit">
                <label>Nickname *<input v-model.trim="f.nickname" maxlength="60" required></label>
                <label>Progreso (1-100) *<input v-model.number="f.progress" type="number" min="1" max="100" required></label>
                <label>Nombre del nivel *<input v-model.trim="f.level_name" maxlength="100" required></label>
                <label>ID del nivel *<input v-model.trim="f.level_id" inputmode="numeric" pattern="[0-9]{1,12}" required></label>
                <label>Link del video (YouTube) *<input v-model.trim="f.video" type="url" maxlength="300" required placeholder="https://youtube.com/watch?v=..."></label>
                <label>Link de tu canal de YouTube<input v-model.trim="f.channel" type="url" maxlength="300"></label>
                <label>FPS (opcional)<input v-model.number="f.hz" type="number" min="1" max="1000"></label>
                <details>
                    <summary>Solo si es un nivel nuevo para la lista</summary>
                    <label>Password del nivel<input v-model.trim="f.password" maxlength="40"></label>
                    <label>Creadores del nivel<input v-model.trim="f.creators" maxlength="200"></label>
                    <label>Verificador (si eres el primero pon tu nickname)<input v-model.trim="f.verifier" maxlength="60"></label>
                    <label>Publisher<input v-model.trim="f.publisher" maxlength="60"></label>
                </details>
                <input v-model="trap" class="trap" tabindex="-1" autocomplete="off" aria-hidden="true">
                <p v-if="error" class="note error">{{ error }}</p>
                <Btn :disabled="busy" @click.native.prevent="onSubmit">{{ busy ? 'Enviando…' : 'Enviar' }}</Btn>
            </form>
        </main>
    `,
    data: () => ({
        configured: isConfigured(),
        sent: false,
        busy: false,
        error: '',
        trap: '',
        f: {
            nickname: '', progress: null, level_name: '', level_id: '', video: '',
            channel: '', hz: null, password: '', creators: '', verifier: '', publisher: '',
        },
    }),
    methods: {
        async onSubmit() {
            if (this.busy) return;
            this.error = '';
            if (this.trap) { this.sent = true; return; } // bot: se ignora en silencio
            const f = this.f;
            if (!f.nickname || !f.level_name || !/^\d{1,12}$/.test(f.level_id) ||
                !(f.progress >= 1 && f.progress <= 100) || !/^https?:\/\//i.test(f.video)) {
                this.error = 'Revisa los campos obligatorios (*).';
                return;
            }
            const row = {};
            for (const [k, v] of Object.entries(f)) {
                if (v !== '' && v !== null) row[k] = v;
            }
            row.level_id = String(row.level_id);
            this.busy = true;
            try {
                await submitRecord(row);
                this.sent = true;
            } catch {
                this.error = 'No se pudo enviar. Revisa los datos e inténtalo de nuevo.';
            } finally {
                this.busy = false;
            }
        },
    },
};
