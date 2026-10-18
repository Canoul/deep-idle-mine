/* Inventaire global (hors session), conservé dans le navigateur. */
const KEY='deepIdleMine.global';

export function loadGlobal(){
  try { return JSON.parse(localStorage.getItem(KEY)||'{}'); } catch(e){ return {}; }
}

/* verse le coffre de fin de session dans l'inventaire global */
export function addToGlobal(global, chest){
  for(const k in chest) global[k]=(global[k]||0)+chest[k];
  try { localStorage.setItem(KEY, JSON.stringify(global)); } catch(e){}
  return global;
}
