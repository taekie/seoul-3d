// Timetable math shared by rendering and tests. Day 0 = Monday; times are KST minutes.
export const clockText=minutes=>`${String(Math.floor(minutes/60)%24).padStart(2,'0')}:${String(Math.floor(minutes)%60).padStart(2,'0')}`;
export function serviceAt(train,minute,weekday){
  // After midnight include the previous day's departures, with their original day rule.
  for(const offset of [0,1440]){
    const day=(weekday-(offset?1:0)+7)%7,t=minute+offset,s=train.stops;
    if(!train.days.includes(day)||t<s[0][1]||t>=s.at(-1)[1])continue;
    const i=s.findIndex((stop,j)=>j>0&&t<stop[1]);
    if(i<1)continue;
    return {from:s[i-1][0],to:s[i][0],fraction:(t-s[i-1][1])/(s[i][1]-s[i-1][1]),nextTime:s[i][1],minute:t};
  }
  return null;
}
export function routeDistance(path,stopDistances,state){
  const a=stopDistances[state.from],b=stopDistances[state.to];
  return a+(b-a)*state.fraction;
}
