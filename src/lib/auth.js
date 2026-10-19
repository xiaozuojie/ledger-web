import { supabase, hasSupabase } from './supabase.js'

/** @returns {Promise<import('@supabase/supabase-js').User|null>} */
export async function getAuthUser() {
  if (!hasSupabase) return null
  const { data } = await supabase.auth.getUser()
  return data?.user || null
}

export async function getAuthSession() {
  if (!hasSupabase) return null
  const { data } = await supabase.auth.getSession()
  return data?.session || null
}

export async function signUp(email, password) {
  if (!hasSupabase) throw new Error('未配置 Supabase')
  const { data, error } = await supabase.auth.signUp({
    email: String(email || '').trim(),
    password: String(password || '')
  })
  if (error) throw new Error(error.message)
  return data
}

export async function signIn(email, password) {
  if (!hasSupabase) throw new Error('未配置 Supabase')
  const { data, error } = await supabase.auth.signInWithPassword({
    email: String(email || '').trim(),
    password: String(password || '')
  })
  if (error) throw new Error(error.message)
  return data
}

export async function signOut() {
  if (!hasSupabase) return
  await supabase.auth.signOut()
}

export function onAuthChange(cb) {
  if (!hasSupabase) return () => {}
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    cb(session?.user || null)
  })
  return () => data.subscription.unsubscribe()
}
