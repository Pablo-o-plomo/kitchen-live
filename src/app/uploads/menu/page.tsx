'use client';
import { useState } from 'react';
export default function UploadMenu(){const [preview,setPreview]=useState<any>(null);const [restaurantId,setRid]=useState('1');
async function onUpload(e:any){e.preventDefault();const fd=new FormData();fd.append('restaurantId',restaurantId);fd.append('file',e.target.file.files[0]);const r=await fetch('/api/menu/import-preview',{method:'POST',body:fd});setPreview(await r.json());}
async function confirm(){await fetch('/api/menu/import-confirm',{method:'POST',body:JSON.stringify(preview)});alert('Импорт завершен');}
return <div><h1>Импорт меню</h1><form onSubmit={onUpload} className='card'><input value={restaurantId} onChange={e=>setRid(e.target.value)}/><input name='file' type='file' accept='.xlsx,.xls'/><button>Предпросмотр</button></form>{preview&&<div className='card'><pre>{JSON.stringify(preview.rows?.slice(0,10),null,2)}</pre><button onClick={confirm}>Подтвердить импорт</button></div>}</div>}
