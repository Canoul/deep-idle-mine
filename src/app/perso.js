/* Couche appli : onglets « Équipement | Stats » de l'onglet Stuff (03/11/2026, Jules ; spec
   docs/superpowers/specs/2026-11-03-appli-perso-sets-stuff-design.md). Équipement : le mannequin (#stuffGrid) ; Stats :
   la carte « Stats du mineur ». L'affichage est dans src/app/app.css (classe stuffOnStats sur la section). */
const TABS = [['gear', 'Équipement'], ['stats', 'Stats']];

export const stuffTabsHtml = tab => TABS.map(([id, label]) => `<button data-stab="${id}"${id === tab ? ' class="on"' : ''}>${label}</button>`).join('');

/* l'onglet choisi est retenu tant que la page est ouverte */
export function startPerso({ doc }){
  const sec = doc.querySelector('section[data-view="stuff"]'), sets = sec?.querySelector('.setsCard'), grid = doc.getElementById('stuffGrid');
  if(!sec || !sets || !grid) return;
  let tab = 'gear';
  const bar = doc.createElement('div'), hint = doc.createElement('p');
  bar.className = 'seg stuffTabs'; hint.className = 'stuffHint mut'; hint.textContent = 'Touche une case pour la changer';
  sets.after(bar); grid.after(hint);
  const draw = () => { bar.innerHTML = stuffTabsHtml(tab); sec.classList.toggle('stuffOnStats', tab === 'stats'); };
  bar.onclick = e => { const b = e.target.closest('[data-stab]'); if(b){ tab = b.dataset.stab; draw(); } };
  draw();
}
