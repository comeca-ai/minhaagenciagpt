export function validWorkspace(state){
  const s=state?.studio;
  return state&&state.schema===1&&typeof state==='object'&&!Array.isArray(state)&&
    ['areas','agents','steps','adjustments','history'].every(k=>Array.isArray(state[k]))&&
    s&&s.version===1&&['people','projects','meetings','tasks'].every(k=>Array.isArray(s[k]))&&
    s.people.length<=100&&s.projects.length<=200&&s.meetings.length<=500&&s.tasks.length<=1000&&
    (s.challenges===undefined||(Array.isArray(s.challenges)&&s.challenges.length<=2000&&
      new Set(s.challenges.map(c=>c?.id)).size===s.challenges.length&&s.challenges.every(c=>
        c&&typeof c.id==='string'&&c.id.length<=150&&typeof c.brief==='string'&&c.brief.length<=30000)));
}
