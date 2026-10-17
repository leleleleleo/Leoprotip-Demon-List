import { store } from "../main.js";
import { embed } from "../util.js";
import { score } from "../score.js";
import { fetchEditors, fetchList } from "../content.js";

import Spinner from "../components/Spinner.js";
import LevelAuthors from "../components/List/LevelAuthors.js";

const roleIconMap = {
    owner: "crown",
    admin: "user-gear",
    helper: "user-shield",
    dev: "code",
    trial: "user-lock",
};

export default {
    components: { Spinner, LevelAuthors },
    template: `
        <main v-if="loading">
            <Spinner></Spinner>
        </main>
        <main v-else class="page-list">
            <div class="list-container">
                <table class="list" v-if="list">
                    <tr v-for="([level, err], i) in list">
                        <td class="rank">
                            <p v-if="i + 1 <= 150" class="type-label-lg">#{{ i + 1 }}</p>
                            <p v-else class="type-label-lg">Legacy</p>
                        </td>
                        <td class="level" :class="{ 'active': selected == i, 'error': !level }">
                            <button @click="selected = i">
                                <span class="type-label-lg">{{ level?.name || \`Error (\${err}.json)\` }}</span>
                            </button>
                        </td>
                    </tr>
                </table>
            </div>
            <div class="level-container">
                <div class="level" v-if="level">
                    <h1>{{ level.name }}</h1>
                    <LevelAuthors :author="level.author" :creators="level.creators" :verifier="level.verifier"></LevelAuthors>
                    <iframe class="video" id="videoframe" :src="video" frameborder="0"></iframe>
                    <ul class="stats">
                        <li>
                            <div class="type-title-sm">Puntos al completar</div>
                            <p>{{ score(selected + 1, 100, level.percentToQualify) }}</p>
                        </li>
                        <li>
                            <div class="type-title-sm">ID</div>
                            <p>{{ level.id }}</p>
                        </li>
                        <li>
                            <div class="type-title-sm">Contraseña</div>
                            <p>{{ level.password || 'Copia libre' }}</p>
                        </li>
                    </ul>
                    <h2>Récords</h2>
                    <p v-if="selected + 1 <= 75"><strong>{{ level.percentToQualify }}%</strong> o más para calificar</p>
                    <p v-else-if="selected +1 <= 150"><strong>100%</strong> o más para calificar</p>
                    <p v-else>Este nivel ya no acepta nuevos récords.</p>
                    <table class="records">
                        <tr v-for="record in level.records" class="record">
                            <td class="percent">
                                <p>{{ record.percent }}%</p>
                            </td>
                            <td class="user">
                                <a :href="record.link" target="_blank" class="type-label-lg">{{ record.user }}</a>
                            </td>
                            <td class="mobile">
                                <img v-if="record.mobile" :src="\`assets/phone-landscape\${store.dark ? '-dark' : ''}.svg\`" alt="Mobile">
                            </td>
                            <td class="hz">
                                <p>{{ record.hz }}Hz</p>
                            </td>
                        </tr>
                    </table>
                </div>
                <div v-else class="level" style="height: 100%; justify-content: center; align-items: center;">
                    <p>(ノಠ益ಠ)ノ彡┻━┻</p>
                </div>
            </div>
            <div class="meta-container">
                <div class="meta">
                    <div class="errors" v-show="errors.length > 0">
                        <p class="error" v-for="error of errors">{{ error }}</p>
                    </div>
                    <div class="og">
                        <p class="type-label-md">Diseño del sitio web creado por <a href="https://tsl.pages.dev/" target="_blank">TheShittyList</a></p>
                    </div>
                    <template v-if="editors">
                        <h3>Editores de la lista</h3>
                        <ol class="editors">
                            <li v-for="editor in editors">
                                <img :src="\`assets/\${roleIconMap[editor.role]}\${store.dark ? '-dark' : ''}.svg\`" :alt="editor.role">
                                <a v-if="editor.link" class="type-label-lg link" target="_blank" :href="editor.link">{{ editor.name }}</a>
                                <p v-else>{{ editor.name }}</p>
                            </li>
                        </ol>
                    </template>
                    <h3>Requisitos de envío</h3>
                    <p>
                        Haber logrado el récord sin usar hacks (sin embargo, se permite el FPS bypass, hasta 360 fps)
                    </p>
                    <p>
                        Haber logrado el récord en el nivel que aparece en el sitio; por favor revisa el ID del nivel antes de enviar un récord
                    </p>
                    <p>
                        Que el video tenga el audio original o los clics/toques. El audio editado por sí solo no cuenta
                    </p>
                    <p>
                        La grabación debe mostrar un intento previo y la animación de muerte completa antes de la finalización, a menos que la finalización sea en el primer intento. Los récords de Everyplay están exentos de esto
                    </p>
                    <p>
                        La grabación también debe mostrar al jugador tocando la pared final (endwall); de lo contrario, la finalización será invalidada.
                    </p>
                    <p>
                        No usar rutas secretas ni rutas con bugs
                    </p>
                    <p>
                        No usar modos fáciles; solo califica un récord del nivel sin modificar
                    </p>
                    <p>
                        Una vez que un nivel cae a la Legacy List, aceptamos récords de ese nivel durante 24 horas después de que salga de la lista; pasado ese tiempo, nunca más aceptamos récords de dicho nivel
                    </p>
                </div>
            </div>
        </main>
    `,
    data: () => ({
        list: [],
        editors: [],
        loading: true,
        selected: 0,
        errors: [],
        roleIconMap,
        store
    }),
    computed: {
        level() {
            return this.list[this.selected][0];
        },
        video() {
            if (!this.level.showcase) {
                return embed(this.level.verification);
            }

            return embed(
                this.toggledShowcase
                    ? this.level.showcase
                    : this.level.verification
            );
        },
    },
    async mounted() {
        // Hide loading spinner
        this.list = await fetchList();
        this.editors = await fetchEditors();

        // Error handling
        if (!this.list) {
            this.errors = [
                "No se pudo cargar la lista. Inténtalo de nuevo en unos minutos o avisa al staff de la lista.",
            ];
        } else {
            this.errors.push(
                ...this.list
                    .filter(([_, err]) => err)
                    .map(([_, err]) => {
                        return `No se pudo cargar el nivel. (${err}.json)`;
                    })
            );
            if (!this.editors) {
                this.errors.push("No se pudieron cargar los editores de la lista.");
            }
        }

        this.loading = false;
    },
    methods: {
        embed,
        score,
    },
};
