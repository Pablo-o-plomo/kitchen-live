'use client';
export default function Login(){async function submit(e:any){e.preventDefault();const fd=new FormData(e.target);await fetch('/api/auth/login',{method:'POST',body:JSON.stringify(Object.fromEntries(fd.entries()))});location.href='/';}
return <form onSubmit={submit} className='card'><h1>Login</h1><input name='username' placeholder='username'/><input name='password' type='password' placeholder='password'/><button>Войти</button></form>}
