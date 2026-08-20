import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();



export const supabase = createClient(
  process.env.SUPABASE_URL!,
<<<<<<< HEAD
  process.env.SUPABASE_ANON_KEY!,
);

// import * as dotenv from 'dotenv';
// import { createClient } from '@supabase/supabase-js';

// dotenv.config();

// console.log(process.env.SUPABASE_URL);

// export const supabase = createClient(
//   process.env.SUPABASE_URL!,
//   process.env.SUPABASE_ANON_KEY!,
// );
=======
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);
>>>>>>> origin/raza
