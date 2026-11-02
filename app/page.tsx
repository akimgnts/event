import {dashboardData} from '@/lib/dashboard';
import Cockpit from './ui/Cockpit';
export const dynamic='force-dynamic';
export default async function Home(){try{return <Cockpit data={JSON.parse(JSON.stringify(await dashboardData()))}/>}catch{return <main><h1>Event Signal · YEVA</h1><p>Le tableau de bord est momentanément indisponible. Les données ne sont pas remplacées par des valeurs estimées.</p></main>}}
