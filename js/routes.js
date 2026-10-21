import List from './pages/List.js';
import Leaderboard from './pages/Leaderboard.js';
import Roulette from './pages/Roulette.js';
import Submit from './pages/Submit.js';
import Admin from './pages/Admin.js';

export default [
    { path: '/', component: List },
    { path: '/sin-rate', component: List, props: { unrated: true } },
    { path: '/leaderboard', component: Leaderboard },
    { path: '/roulette', component: Roulette },
    { path: '/enviar', component: Submit },
    { path: '/admin', component: Admin },
];
