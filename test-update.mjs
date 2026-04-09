import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://tkovigthghwpwbtjikyp.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRrb3ZpZ3RoZ2h3cHdidGppa3lwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0MDg4NjYsImV4cCI6MjA5MDk4NDg2Nn0.O289ZgBmbwmbEALlspdR5vhLcHhOyuZux2Ow_QiM3tU'
const supabase = createClient(supabaseUrl, supabaseKey)

async function test() {
  const { data, error } = await supabase.from('products').update({ faqs: [] }).eq('id', 'google-play')
  console.log(error)
}

test()
