const axios = require('axios');

const API_KEY = 'bddc3363-551c-4a1b-b5f5-7d809e727e19';
const MATCH_ID = '4bbbc784-97df-4a9f-868e-d02f084df80e';
const API_URL = `https://api.cricapi.com/v1/cricScore?apikey=${API_KEY}&id=${MATCH_ID}`;

axios.get(API_URL)
  .then(response => {
    const match = response.data.data[0];

    if (!match) {
      console.error('No match data found');
      return;
    }

    const team1 = match.t1;
    const team2 = match.t2;
    const status = match.status;
    const series = match.series;
    const team1Score = match.t1s || 'N/A';
    const team2Score = match.t2s || 'N/A';

    const liveUpdate = `
            ❌ *𝘓𝘐𝘝𝘌 𝘜𝘗𝘋𝘈𝘛𝘌* ❌

*${team1}* 𝘝𝘚 *${team2}*
    (${series})
        
> *${team1}* 🏏: ${team1Score}
> *${team2}* 🏏: ${team2Score}

*Status:* ${status}

© ⚽*SPORTS WORLD*🏏

https://chat.whatsapp.com/C2T0r1c2vLj8RdC3CII2Ky 
`;

    console.log(liveUpdate);
  })
  .catch(error => {
    console.error('Error fetching match details:', error);
  });
