import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';

const app = express();
const port = 3001;

app.use(cors());

// Credenziali
const CREDENTIALS = {
  email: 'fantavecchio@gmail.com',
  password: 'Fantavecchio'
};

// ⚠️ TEMPORANEO: Inserisci qui i cookie del tuo browser
// Vai su https://www.fantacalcio.it (loggato), apri DevTools → Application → Cookies
// Copia i cookie e incollali qui nel formato: 'nome1=valore1; nome2=valore2'
const MANUAL_COOKIES = '_gid=GA1.2.377855492.1768137759; _fbp=fb.1.1768137758695.547293998108032570; usprivacy=1---; euconsent-v2=CQd3RAAQd3RAAAKA9AITCNFsAP_gAEPgABCYL6NR_G__bXlr-bb36ftkeYxf9_hr7sQxBgbJk24FzLvW7JwX32E7NAzatqYKmRIAu3TBIQNlHJDURVCgKIgFrzDMaEyUoTtKJ6BkiFMZY2tYCFxvm4tjWQCY4vr99ld9mR-N7dr82dzy26hnv3a9_-S1UJCdIYetDfv8ZBKT-9IE9_x8v4v4_N7pE2-eS1n_tGvp4j9-YvP_dBmxt-TSff7Pn__rl_e7X__c_n37v94XX77__-__f_-7___2b_-_wXsAAMBAAgiBIAQAAAAAIAACAAAAAgAAAAAgBQAAAiCAACBgAAIAEAIAAAAgAAgAAAgAAAAAQABAAAAACAQAgACBQABgAAAAAAMAAAGACQEAAABAMAxTAggECgACEiiCCAFAACCAEIAEAgGABACAAo4AggBAgUAAAIAAQAAACwEAgAICUgQABEQDAAAEAAAUQAgAIQsABBEAIBQRACcBgKIBg0IAklKgyAAgBAyTIhE-EQMQgBAgBSA2KEYA6eICAKEg5gALgAoAC4AHAAPAAgABJAC8ANQAeABDACYAFUAN4AfgBCQCGAIkARwAmgBWgDAAGHAMoAywBsgDngHcAd4A9oB9gH6AQAAikBFwEYgI0AjkBIgEmgJ-AoMBUAFXALmAXoAxQBogDaAG4AOIAe0BDsCPQJFATSAnYBQ4CjwFIgKbAWwAuABcgC7AF3gLzAYbAyMDJAGTgMuAZmAzkBn0DVwNZAbGA2gBt4DcwG6gOTAcuA8cB8YD_gICAQTAgwBCGCFoIXwQ9BD8CPoEioJMAkyBLMCW8EvgTAAmWBM4CaoE2AJuQTmBOkCdwE8IKDgoQBQsCioFJQKXAUyAp5BT8FQAKjAVOAq6BWwCt4FfALCgWOAsqBaaC1gLWgW5AuKBeodCEAAXABQAFQAOAAgABJAC4ANQAeABMACmAFWALgAugBiADeAH6AQwBEgCOAE0AKMAVoAwABhgDKAGiANkAc8A7gDvAHtAPsA_YCKAIxARwBJoCfgKDAVEBVwCxAFzgLyAvQBigDaAG4gOIA4wB7QD7AIQAQ6AicBF8CPQJFATIAmkBOwCh4FHgUgApMBTYCrAFigLYAW6AuABckC7ALtAXeAvMBfQDDQGPQMjAySBk4GVQMsAy4BmYDOQGfANNAarA1cDWAG0ANvAbqA4sByYDlwHjgPjAfWA-4B_YD_gIAgQEAgwBC0CHoEdgI-gSEAkUBJkCVcEswS0Al1BL4EwAJlgTOAmqBNgCbkE5gTpgnaCdwE8AJ5gUGAoQBQsCiQFFQKSgUuAp4BT8CowFToKuAq6BWwCt4FgwLJgWVgtYC1oFuQLdgXFAuWBeohA-AAWABQAFwANQAqgBcADEAG8APwAwABzwDuAO8AigBHACUgFBgKiAq4BcwDFAG0AOMAh0BE4CPQE0gKTAU2AqwBYoC0QFwALkAXYAyMBk4DOQGqgPHAfGA_sCAgEGAIWgQ9AkIBIoCXQEzgJsATmAncBPACeYFBgKKgUlApcBT8Cr4FggLWgW5JQUAAFgAUAA4ACQAHgAQwAmABVAC4AGKAQwBEgCOAFGAK0AYAA2QB3gD8AI5AVEBVwC5gGKAOIAhABDoCL4EegSKAo8BScCmgKbAWKAtgBcgC7AF5wMjAyQBk4DLAGcgM-AawA28B8YEAQICAQPAgwBCECHoEfQJFASVAlWBK0CXQEvgJnATVAmwBNwCc0E7QTuAngBPMCioFJQKXAU8AqMBU4CtgFb4LBAsGBYsCysFrAWtAtyBcgC5YF6ikG4ABcAFAAVAA4ACCAGQAaAA8ACGAEwAKoAYgA_QCGAIkARwAowBWgDAAGUANEAbIA5wB3wD7AP0AiwBGICOAJKAUGAqICrgFzALyAYoA2gBuIDiAOMAe0A-wCHQETgIvgR6BIoCaQE7AKHAUgApOBTQFNgKsAWKAtgBcAC5IF2AXaAvMBfQDDYGRgZIAyeBlgGXAM5gawBrIDbwG6gOTAeKA8cB8YD-wH_AQEAgmBBgCEIELQIZgQ5AjsBH0CRUEmASZAlWBLMCXUEvgTAAmWBM4CaoE2AJzQTtBO4CeAE8wKFgUVApKBS4CngFPwKjAVOArYBW8CwQFhQLFgWTAsrBawFrQLcgXFAuQBeoAA.IAAA.f_gAAAAAAAAA; addtl_consent=1~43.3.9.6.9.13.6.4.15.9.5.2.11.8.1.3.2.10.33.4.15.17.2.9.20.7.20.5.20.9.2.1.4.40.4.14.9.13.8.9.6.6.9.41.5.3.1.27.1.17.10.10.8.6.2.8.3.4.146.65.1.17.19.25.35.5.18.9.7.21.20.2.4.18.24.4.9.6.5.2.14.25.3.2.2.8.2.26.8.6.3.10.4.20.2.17.10.11.1.3.22.16.2.6.8.6.11.6.5.17.16.11.19.28.12.1.5.2.17.9.6.40.17.4.9.15.8.7.3.12.7.2.4.1.19.13.22.13.2.6.8.10.1.4.15.2.4.9.4.5.4.7.13.5.15.17.4.14.10.15.2.5.6.2.2.1.2.14.11.8.2.9.28.12.13.2.18.1.1.3.1.1.9.7.2.16.5.19.8.4.8.5.4.8.4.4.2.14.2.13.4.2.6.9.6.3.2.2.3.7.9.10.11.9.19.8.3.3.1.2.3.9.19.22.4.3.27.3.4.6.3.3.3.4.1.7.11.4.1.11.6.1.10.13.3.2.2.4.3.2.2.7.15.7.14.4.3.4.5.7.2.2.5.5.3.9.7.9.1.5.3.7.10.11.1.3.1.1.2.1.3.2.6.1.12.8.1.3.1.1.2.2.7.6.1.1.4.3.6.1.2.1.4.1.1.4.1.1.2.1.8.1.7.4.3.3.3.5.3.15.1.15.10.28.1.2.2.12.3.4.1.6.3.4.7.1.3.1.4.1.5.3.1.2.1.4.1.5.2.3.1.2.2.6.2.1.2.2.2.5.1.1.2.2.1.1.1.1.2.1.1.1.2.2.1.1.2.1.2.1.7.1.7.1.1.2.2.1.4.2.1.1.9.1.6.2.1.6.2.3.2.1.1.1.2.5.2.4.1.1.2.2.1.1.7.1.2.2.1.2.1.2.3.1.1.2.4.1.1.1.9.6.4.5.9.1.2.3.1.4.3.2.2.3.1.1.1.1.12.1.3.1.1.2.2.1.6.3.3.5.2.7.1.1.2.5.1.9.5.1.3.1.8.4.5.1.9.1.1.1.2.1.1.1.4.2.13.1.1.3.1.2.5.1.2.1.1.1.2.1.3.1.1.1.1.2.4.1.5.1.2.4.3.10.2.9.7.2.2.1.3.3.1.6.1.2.5.1.1.2.6.4.2.1.200.200.100.300.400.100.100.100.400.1700.304.596.100.1000.800.500.400.200.200.500.2101.99.303.99.104.95.1399.1100.100.4302.1798.2100.800.100.600.200.900.100.200.700.100.800.2900.1400.300.400.2200.2300.400.1101.499.400.2100.100.100.2100.100.1201.299.600.1100.101.99.1400.2000; IABGPP_HDR_GppString=DBABMA~CQd5GlIQd5GlIAKA9AITCNFsAP_gAEPgABCYL6NR_G__bXlr-bb36ftkeYxf9_hr7sQxBgbJk24FzLvW7JwX32E7NAzatqYKmRIAu3TBIQNlHJDURVCgKIgFrzDMaEyUoTtKJ6BkiFMZY2tYCFxvm4tjWQCY4vr99ld9mR-N7dr82dzy26hnv3a9_-S1UJCdIYetDfv8ZBKT-9IE9_x8v4v4_N7pE2-eS1n_tGvp4j9-YvP_dBmxt-TSff7Pn__rl_e7X__c_n37v94XX77__-__f_-7___2b_-_wXsAAMBAAgiBIAQAAAAAIAACAAAAAgAAAAAgBQAAAiCAACBgAAIAEAIAAAAgAAgAAAgAAAAAQABAAAAACAQAgACBQABgAAAAAAMAAAGACQEAAABAMAxTAggECgACEiiCCAFAACCAEIAEAgGABACAAo4AggBAgUAAAIAAQAAACwEAgAICUgQABEQDAAAEAAAUQAgAIQsABBEAIBQRACcBgKIBg0IAklKgyAAgBAyTIhE-EQMQgBAgBSA2KEYA6eICAKEg5gALgAoAC4AHAAPAAgABJAC8ANQAeABDACYAFUAN4AfgBCQCGAIkARwAmgBWgDAAGHAMoAywBsgDngHcAd4A9oB9gH6AQAAikBFwEYgI0AjkBIgEmgJ-AoMBUAFXALmAXoAxQBogDaAG4AOIAe0BDsCPQJFATSAnYBQ4CjwFIgKbAWwAuABcgC7AF3gLzAYbAyMDJAGTgMuAZmAzkBn0DVwNZAbGA2gBt4DcwG6gOTAcuA8cB8YD_gICAQTAgwBCGCFoIXwQ9BD8CPoEioJMAkyBLMCW8EvgTAAmWBM4CaoE2AJuQTmBOkCdwE8IKDgoQBQsCioFJQKXAUyAp5BT8FQAKjAVOAq6BWwCt4FfALCgWOAsqBaaC1gLWgW5AuKBeodCEAAXABQAFQAOAAgABJAC4ANQAeABMACmAFWALgAugBiADeAH6AQwBEgCOAE0AKMAVoAwABhgDKAGiANkAc8A7gDvAHtAPsA_YCKAIxARwBJoCfgKDAVEBVwCxAFzgLyAvQBigDaAG4gOIA4wB7QD7AIQAQ6AicBF8CPQJFATIAmkBOwCh4FHgUgApMBTYCrAFigLYAW6AuABckC7ALtAXeAvMBfQDDQGPQMjAySBk4GVQMsAy4BmYDOQGfANNAarA1cDWAG0ANvAbqA4sByYDlwHjgPjAfWA-4B_YD_gIAgQEAgwBC0CHoEdgI-gSEAkUBJkCVcEswS0Al1BL4EwAJlgTOAmqBNgCbkE5gTpgnaCdwE8AJ5gUGAoQBQsCiQFFQKSgUuAp4BT8CowFToKuAq6BWwCt4FgwLJgWVgtYC1oFuQLdgXFAuWBeohA-AAWABQAFwANQAqgBcADEAG8APwAwABzwDuAO8AigBHACUgFBgKiAq4BcwDFAG0AOMAh0BE4CPQE0gKTAU2AqwBYoC0QFwALkAXYAyMBk4DOQGqgPHAfGA_sCAgEGAIWgQ9AkIBIoCXQEzgJsATmAncBPACeYFBgKKgUlApcBT8Cr4FggLWgW5JQUAAFgAUAA4ACQAHgAQwAmABVAC4AGKAQwBEgCOAFGAK0AYAA2QB3gD8AI5AVEBVwC5gGKAOIAhABDoCL4EegSKAo8BScCmgKbAWKAtgBcgC7AF5wMjAyQBk4DLAGcgM-AawA28B8YEAQICAQPAgwBCECHoEfQJFASVAlWBK0CXQEvgJnATVAmwBNwCc0E7QTuAngBPMCioFJQKXAU8AqMBU4CtgFb4LBAsGBYsCysFrAWtAtyBcgC5YF6ikG4ABcAFAAVAA4ACCAGQAaAA8ACGAEwAKoAYgA_QCGAIkARwAowBWgDAAGUANEAbIA5wB3wD7AP0AiwBGICOAJKAUGAqICrgFzALyAYoA2gBuIDiAOMAe0A-wCHQETgIvgR6BIoCaQE7AKHAUgApOBTQFNgKsAWKAtgBcAC5IF2AXaAvMBfQDDYGRgZIAyeBlgGXAM5gawBrIDbwG6gOTAeKA8cB8YD-wH_AQEAgmBBgCEIELQIZgQ5AjsBH0CRUEmASZAlWBLMCXUEvgTAAmWBM4CaoE2AJzQTtBO4CeAE8wKFgUVApKBS4CngFPwKjAVOArYBW8CwQFhQLFgWTAsrBawFrQLcgXFAuQBeoAA.f_gAAAAAAAAA; cacheid=1768139576839.6650666520220991; tncid=6dbb9fc9-247f-4b45-9f55-eed581eb6116; _scor_uid=236ab8d216514c42bbc0dee7b1371ca3; __gads=ID=e9a9a39fc94509da:T=1768137760:RT=1768141372:S=ALNI_MaPO2pkx2_4Xu6Jwmb_dq6gB7GZ8g; __gpi=UID=000012e98c8748f2:T=1768137760:RT=1768141372:S=ALNI_MZw6ylenkWfk-M_IP8PqWLhnG_fSg; __eoi=ID=4590b6ff9c976864:T=1768137760:RT=1768141372:S=AA-AfjbJEo8NPbdcEcyhi9ecsCBd; fantacalcio.it=GgQC6Xbc3d14Bgrz1lLee%2B0eVb6AtJTpDtKB8leDxcN0XR0zXLc1yXvVjkfhvIhHDtKB8leDxcMMJbiWYzuft8Ppp7PkgGsw3oJWd2OcPdMPEAM3LEVNGNR9ALJDrImrdnvXc4s4AxHvmIL8yWTj5GK%2BmBph5g8Ag3%2BNmXIZlbmNOQq%2F3boh%2FtyQ%2BiTup%2BcM0U9M70%2FBb3kaFg3uf7m%2FH1zDr%2BajIP3FocOQIQ%2FlG6IdxiCEtvz5kA21DRIdOVCFKsonrIBSOAuSpO3HQ0Wpxna0OJ05VG%2BO6gQPapdLjD%2B9dG97MgqhHEl4%2F%2BbnRhrgAZHX3TTkeYihdsJpkDM9Y38vvc5Etm5R9AKYkKUol7AZTXy%2BGkJkdX6rgX1GNxi9KP5i786iv80VWt6m4KeUFXU5%2BSvSPo0pLhG9ec4b0fD9yO8GVD3%2BNQ7SgfJXg8XDDCW4lmM7n7fD6aez5IBrMIhTpCqncYR6; client.fantacalcio.it=fantavecchio%40gmail.com; _ga_KVFYCX9ZTZ=GS2.1.s1768137758$o1$g1$t1768141429$j3$l0$h0; _ga=GA1.1.2126172159.1768137759; AWSALB=1j0IsVg5wTiArZ8abVQ0UL6K0R0V9qvVr1KP2/2nbpjQU+9kmXDgmkuKC8KvsygtPa7gyVT50wknmuRn39qWQ2kbKeHwc+R3WAITMHuDaeZ7f9c+I948o9gfnxPt; AWSALBCORS=1j0IsVg5wTiArZ8abVQ0UL6K0R0V9qvVr1KP2/2nbpjQU+9kmXDgmkuKC8KvsygtPa7gyVT50wknmuRn39qWQ2kbKeHwc+R3WAITMHuDaeZ7f9c+I948o9gfnxPt; cto_bundle=BouoO19obG1YdjZOTW4lMkJxMzIyWTRLMm5CdWJJJTJGTUpNJTJCSThaTFFCR3hveEZ1eFAlMkZzbURDTmlwVFV3bEhOampFSVZYUnElMkZ2ZVFPems3UHJBbjh2NTI2OVNyJTJGeTZjQndhSmNEQ3ZidlFyVTV2Y0pxUWFRbktLdGhLdkFxJTJGaEVIOW5KRDhnTVE3V3NwYktNYU9XSlZQZCUyQmFOaTNKVlRCNWRvbiUyQk9XMHhLTTVMd2dsbldZWHp4QjlxYzZ0dSUyRnEyMmtJSkRjSQ';  // ⬅️ COOKIE INSERITI!

let sessionCookies = MANUAL_COOKIES || null;
let cookieExpiry = MANUAL_COOKIES ? Date.now() + (3600000 * 24) : 0;

// Funzione per estrarre CSRF token dall'HTML
function extractCSRFToken(html) {
  // Prova vari pattern
  let match;
  
  // Pattern 1: input con name="_token"
  match = html.match(/<input[^>]*name=["']_token["'][^>]*value=["']([^"']+)["']/i);
  if (match) return match[1];
  
  // Pattern 2: meta tag csrf-token
  match = html.match(/<meta[^>]*name=["']csrf-token["'][^>]*content=["']([^"']+)["']/i);
  if (match) return match[1];
  
  // Pattern 3: meta tag X-CSRF-TOKEN
  match = html.match(/<meta[^>]*name=["']X-CSRF-TOKEN["'][^>]*content=["']([^"']+)["']/i);
  if (match) return match[1];
  
  // Pattern 4: window.csrf_token in JavaScript
  match = html.match(/csrf[_-]?token["']?\s*[:=]\s*["']([^"']+)["']/i);
  if (match) return match[1];
  
  return null;
}

// Funzione per fare login
async function loginAndGetCookies() {
  try {
    console.log('🔐 Step 1: Visita pagina login per ottenere CSRF token...');
    
    // Step 1: GET login page per ottenere CSRF token e cookie iniziali
    const loginPageResponse = await fetch('https://www.fantacalcio.it/login', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    });
    
    const loginPageHTML = await loginPageResponse.text();
    const csrfToken = extractCSRFToken(loginPageHTML);
    console.log('🔑 CSRF Token:', csrfToken ? `trovato: ${csrfToken.substring(0, 20)}...` : 'NON trovato');
    
    let allCookies = [];
    const initialCookies = loginPageResponse.headers.raw()['set-cookie'];
    if (initialCookies) {
      allCookies = initialCookies.map(c => c.split(';')[0]);
      console.log('🍪 Initial cookies:', allCookies.map(c => c.split('=')[0]).join(', '));
    }
    
    // Step 2: POST login con CSRF token
    console.log('🔐 Step 2: Invio credenziali login...');
    
    const formData = new URLSearchParams({
      email: CREDENTIALS.email,
      password: CREDENTIALS.password,
      remember: 'on'
    });
    
    if (csrfToken) {
      formData.append('_token', csrfToken);
    }
    
    const loginResponse = await fetch('https://www.fantacalcio.it/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Origin': 'https://www.fantacalcio.it',
        'Referer': 'https://www.fantacalcio.it/login',
        'Cookie': allCookies.join('; ')
      },
      body: formData.toString(),
      redirect: 'follow'  // Cambiato da 'manual' a 'follow' per seguire i redirect
    });
    
    console.log(`📊 Login status: ${loginResponse.status}`);
    console.log(`🔗 Final URL after redirects: ${loginResponse.url}`);
    
    const loginCookies = loginResponse.headers.raw()['set-cookie'];
    if (loginCookies) {
      console.log('🍪 Login cookies received:', loginCookies.map(c => c.split('=')[0]).join(', '));
      loginCookies.forEach(cookie => {
        const cookieName = cookie.split('=')[0];
        const cookieValue = cookie.split(';')[0];
        // Sostituisci o aggiungi il cookie
        const existingIndex = allCookies.findIndex(c => c.startsWith(cookieName + '='));
        if (existingIndex >= 0) {
          allCookies[existingIndex] = cookieValue;
        } else {
          allCookies.push(cookieValue);
        }
      });
    } else {
      console.log('⚠️  Nessun cookie ricevuto dal login response');
    }
    
    sessionCookies = allCookies.join('; ');
    cookieExpiry = Date.now() + (3600000); // 1 ora
    
    console.log('✅ Cookie di sessione ottenuti');
    console.log('🍪 Final cookies:', allCookies.map(c => c.split('=')[0]).join(', '));
    
    return true;
  } catch (error) {
    console.error('❌ Errore durante il login:', error.message);
    return false;
  }
}

app.get('/api/giocatori', async (req, res) => {
  try {
    console.log('📥 Richiesta ricevuta per scaricare Excel da Fantacalcio.it...');
    
    // Verifica se servono nuovi cookie
    if (!sessionCookies || Date.now() >= cookieExpiry) {
      console.log('🔄 Cookie scaduti o mancanti, effettuo login...');
      const loginSuccess = await loginAndGetCookies();
      if (!loginSuccess) {
        throw new Error('Impossibile autenticarsi');
      }
    }
    
    const excelUrl = 'https://www.fantacalcio.it/api/v1/Excel/stats/20/1';
    
    console.log('📡 Tentativo download Excel...');
    
    const response = await fetch(excelUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/octet-stream,*/*',
        'Accept-Language': 'it-IT,it;q=0.9',
        'Referer': 'https://www.fantacalcio.it/statistiche-serie-a',
        'Cookie': sessionCookies
      }
    });
    
    console.log(`📊 Status: ${response.status}`);
    
    if (!response.ok) {
      // Se 401, prova a rifare login
      if (response.status === 401) {
        console.log('⚠️ 401 ricevuto, nuovo tentativo di login...');
        sessionCookies = null;
        const retryLogin = await loginAndGetCookies();
        
        if (retryLogin) {
          console.log('📡 Retry download Excel...');
          const retryResponse = await fetch(excelUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
              'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
              'Cookie': sessionCookies
            }
          });
          
          console.log(`📊 Retry status: ${retryResponse.status}`);
          
          if (retryResponse.ok) {
            const buffer = await retryResponse.buffer();
            console.log(`✅ Excel scaricato (${buffer.length} bytes)`);
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename="giocatori.xlsx"');
            return res.send(buffer);
          }
        }
      }
      
      throw new Error(`Errore API: ${response.status} ${response.statusText}`);
    }
    
    const buffer = await response.buffer();
    console.log(`✅ Excel scaricato con successo (${buffer.length} bytes)`);
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="giocatori.xlsx"');
    res.send(buffer);
  } catch (error) {
    console.error('❌ Errore:', error.message);
    res.status(500).json({ 
      error: 'Errore durante il download',
      details: error.message 
    });
  }
});

app.listen(port, () => {
  console.log(`Server in ascolto su http://localhost:${port}`);
});
