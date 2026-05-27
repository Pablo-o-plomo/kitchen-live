'use client';
import { useState } from 'react';
export default function Planning(){const [msg,setMsg]=useState('');async function submit(e:any){e.preventDefault();const fd=new FormData(e.target);const data=Object.fromEntries(fd.entries());const res=await fetch('/api/plan',{method:'POST',body:JSON.stringify(data)});setMsg(res.ok?'Сохранено':'Ошибка');}
return <div><h1>Планирование цен</h1><form onSubmit={submit} className='card'><input name='restaurantId' placeholder='restaurantId'/><input name='menuItemId' placeholder='menuItemId'/><input name='newCostPrice' placeholder='newCostPrice'/><input name='newSalePrice' placeholder='newSalePrice'/><input name='plannedDate' type='date'/><input name='comment' placeholder='comment'/><button>Создать план</button></form><p>{msg}</p></div>}
