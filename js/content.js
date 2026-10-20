import { round, score } from './score.js';

/**
 * Default path to the directory containing `_list.json` and all levels
 * (the "Sin rate" list passes its own folder, `data/unrated`)
 */
// Relative path: works on GitHub Pages under any repo name, and locally
const DEFAULT_DIR = 'data';

export async function fetchList(dir = DEFAULT_DIR) {
    const listResult = await fetch(`${dir}/_list.json`);
    try {
        const list = await listResult.json();
        return await Promise.all(
            list.map(async (path, rank) => {
                const levelResult = await fetch(`${dir}/${path}.json`);
                try {
                    const level = await levelResult.json();
                    return [
                        {
                            ...level,
                            path,
                            records: (level.records ?? []).sort(
                                (a, b) => b.percent - a.percent,
                            ),
                        },
                        null,
                    ];
                } catch {
                    console.error(`Failed to load level #${rank + 1} ${path}.`);
                    return [null, path];
                }
            }),
        );
    } catch {
        console.error(`Failed to load list.`);
        return null;
    }
}

export async function fetchEditors() {
    try {
        const editorsResults = await fetch(`${DEFAULT_DIR}/_editors.json`);
        const editors = await editorsResults.json();
        return editors;
    } catch {
        return null;
    }
}

/**
 * Text used in a level's `verifier` field while nobody has verified it yet
 */
const PENDING_VERIFIER = 'por verificar';

function isPendingVerifier(verifier) {
    return String(verifier ?? '').trim().toLowerCase() === PENDING_VERIFIER;
}

/**
 * Everything the leaderboard keeps for one player. The `...Unrated` lists come
 * from the "Sin rate" list: they show on the player's page but never add points.
 */
function newEntry() {
    return {
        verified: [],
        completed: [],
        progressed: [],
        verifiedUnrated: [],
        completedUnrated: [],
        progressedUnrated: [],
    };
}

export async function fetchLeaderboard() {
    const list = await fetchList();

    const scoreMap = {};
    const errs = [];
    list.forEach(([level, err], rank) => {
        if (err) {
            errs.push(err);
            return;
        }

        // Verification
        // Levels still waiting for a verifier ("Por verificar") don't credit
        // anyone in the leaderboard. Records from other players still count.
        if (!isPendingVerifier(level.verifier)) {
            const verifier = Object.keys(scoreMap).find(
                (u) => u.toLowerCase() === level.verifier.toLowerCase(),
            ) || level.verifier;
            scoreMap[verifier] ??= newEntry();
            const { verified } = scoreMap[verifier];
            verified.push({
                rank: rank + 1,
                level: level.name,
                score: score(rank + 1, 100, level.percentToQualify),
                link: level.verification,
            });
        }

        // Records
        level.records.forEach((record) => {
            const user = Object.keys(scoreMap).find(
                (u) => u.toLowerCase() === record.user.toLowerCase(),
            ) || record.user;
            scoreMap[user] ??= newEntry();
            const { completed, progressed } = scoreMap[user];
            if (record.percent === 100) {
                completed.push({
                    rank: rank + 1,
                    level: level.name,
                    score: score(rank + 1, 100, level.percentToQualify),
                    link: record.link,
                });
                return;
            }

            progressed.push({
                rank: rank + 1,
                level: level.name,
                percent: record.percent,
                score: score(rank + 1, record.percent, level.percentToQualify),
                link: record.link,
            });
        });
    });

    // "Sin rate" list: shown on each player's page as extras, never adds points
    const unratedList = await fetchList('data/unrated');
    if (!unratedList) {
        errs.push('lista sin rate');
    } else {
        const entryFor = (name) => {
            const key = Object.keys(scoreMap).find(
                (u) => u.toLowerCase() === name.toLowerCase(),
            ) || name;
            scoreMap[key] ??= newEntry();
            return scoreMap[key];
        };

        unratedList.forEach(([level, err], rank) => {
            if (err) {
                errs.push(`sin rate: ${err}`);
                return;
            }

            // Same rule as the main list: "Por verificar" is not a player
            if (!isPendingVerifier(level.verifier)) {
                entryFor(level.verifier).verifiedUnrated.push({
                    rank: rank + 1,
                    level: level.name,
                    link: level.verification,
                });
            }

            level.records.forEach((record) => {
                const { completedUnrated, progressedUnrated } = entryFor(record.user);
                if (record.percent === 100) {
                    completedUnrated.push({
                        rank: rank + 1,
                        level: level.name,
                        link: record.link,
                    });
                    return;
                }

                progressedUnrated.push({
                    rank: rank + 1,
                    level: level.name,
                    percent: record.percent,
                    link: record.link,
                });
            });
        });
    }

    // Wrap in extra Object containing the user and total score
    const res = Object.entries(scoreMap).map(([user, scores]) => {
        const { verified, completed, progressed } = scores;
        const total = [verified, completed, progressed]
            .flat()
            .reduce((prev, cur) => prev + cur.score, 0);

        return {
            user,
            total: round(total),
            ...scores,
        };
    });

    // Sort by total score
    return [res.sort((a, b) => b.total - a.total), errs];
}
