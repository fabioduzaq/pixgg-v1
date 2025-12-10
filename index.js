require('dotenv').config();
const express = require('express');
const QRCode = require('qrcode'); // Necessário: npm install qrcode
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const app = express();
const PORT = process.env.PORT || 3000;

// --- Configurações do PixGG (Token fornecido) ---
const PIXGG_AUTH_TOKEN = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImR1emFxQGxpdmUuY29tIiwiaHR0cDovL3NjaGVtYXMubWljcm9zb2Z0LmNvbS93cy8yMDA4LzA2L2lkZW50aXR5L2NsYWltcy91c2VyZGF0YSI6IntcIk5hbWVcIjpcIkZhYmlvIGRhIFNpbHZhIFNvdXphXCIsXCJFbWFpbFwiOlwiZHV6YXFAbGl2ZS5jb21cIixcIlJvbGVcIjpudWxsLFwiSWRcIjo3MDM0OH0iLCJyb2xlIjoiU3RyZWFtZXIiLCJuYmYiOjE3NjEzMzUxMTUsImV4cCI6MTc2MzkyNzExNSwiaWF0IjoxNzYxMzM1MTE1fQ.tvgaBqnyruz046LcMQWrmRgHQFfjcM0StEm8sasSCEk';
const PIXGG_API_URL = 'https://app.pixgg.com/checkouts';
const STREAMER_ID = 70348;

// --- Funções Auxiliares (User Agent e Security Headers) ---

function generateRandomUserAgent() {
    return `Mozilla/5.0 (Windows NT ${Math.floor(Math.random() * 10 + 10)}.0; Win64; x64) AppleWebKit/${Math.floor(Math.random() * 20 + 500)}.36 (KHTML, like Gecko) Chrome/${Math.floor(Math.random() * 20 + 100)}.0.${Math.floor(Math.random() * 5000 + 1000)}.0 Safari/${Math.floor(Math.random() * 20 + 500)}.36`;
}

function generateRandomSecChUa() {
    const brands = [
        '"Not)A;Brand";v="8"',
        '"Chromium";v="' + Math.floor(Math.random() * 20 + 100) + '"',
        '"Google Chrome";v="' + Math.floor(Math.random() * 20 + 100) + '"',
        '"Microsoft Edge";v="' + Math.floor(Math.random() * 20 + 100) + '"',
        '"Firefox";v="' + Math.floor(Math.random() * 10 + 100) + '"'
    ];
    // Select a random subset of brands
    const selectedBrands = brands.sort(() => 0.5 - Math.random()).slice(0, Math.floor(Math.random() * 3) + 1);
    return selectedBrands.join(', ');
}

// --- Função Principal de Geração do Pix (Adaptada para JS) ---

async function generatePixGgCharge(payload) {
    const body = {
        streamerId: STREAMER_ID,
        country: "Brazil",
        minimumDonateAmount: null,
        fileId: null,
        countr: "Brazil", // Mantido conforme snippet original (typo 'countr'?)
        cryptoNetwork: "ETH",
        cryptoCoin: null,
        youTubeVideoId: "",
        YouTubeVideoStart: 0,
        YouTubeVideoEnd: 0,
        ...payload
    };

    const userAgent = generateRandomUserAgent();
    const secChUa = generateRandomSecChUa();

    try {
        const response = await fetch(PIXGG_API_URL, {
            method: 'POST',
            headers: {
                'accept': 'application/json, text/plain, */*',
                'accept-language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
                'authorization': PIXGG_AUTH_TOKEN,
                'content-type': 'application/json',
                'cache-control': 'no-cache',
                'origin': 'https://pixgg.com',
                'pragma': 'no-cache',
                'priority': 'u=1, i',
                'referer': 'https://pixgg.com/',
                'sec-ch-ua': secChUa,
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"macOS"',
                'sec-fetch-dest': 'empty',
                'sec-fetch-mode': 'cors',
                'sec-fetch-site': 'same-site',
                'user-agent': userAgent,
            },
            body: JSON.stringify(body),
        });
        
        const responseData = await response.json();

        if (!response.ok) {
            console.error('PixGG API Error:', responseData);
            throw new Error(`PixGG API respondeu com status ${response.status}`);
        }

        // A resposta deve conter { transactionId, pixUrl, ... }
        return {
            success: true,
            data: responseData,
        };

    } catch (err) {
        console.error('Error in generatePixGgCharge:', err);
        return { success: false, error: err.message || 'Ocorreu um erro inesperado.' };
    }
}

// --- Rotas Express ---

app.get('/', (req, res) => {
    res.send('<h1>Servidor PixGG Ativo</h1><p>Acesse <a href="/pix/10.90">/pix/10.90</a> para testar.</p>');
});

app.get('/pix/:valor', async (req, res) => {
    // Tratamento do valor (substitui vírgula por ponto se necessário)
    let valorRaw = req.params.valor.replace(',', '.');
    const valor = parseFloat(valorRaw);
    
    if (isNaN(valor) || valor <= 0) {
        return res.status(400).send('Valor inválido. Use formato numérico (ex: 10.90)');
    }

    console.log(`Gerando Pix de R$ ${valor.toFixed(2)} via PixGG...`);

    try {
        // 1. Gera a cobrança na API
        const result = await generatePixGgCharge({
            donatorNickname: "Visitante",
            donatorMessage: "Pagamento Teste Node",
            donatorAmount: valor
        });

        if (!result.success || !result.data || !result.data.pixUrl) {
            throw new Error(result.error || "Falha ao obter código Pix da API");
        }

        const pixCode = result.data.pixUrl;

        // 2. Gera a imagem do QR Code em Base64 para exibir no HTML
        const qrCodeDataURL = await QRCode.toDataURL(pixCode, {
            width: 300,
            margin: 2,
            color: {
                dark: "#000000",
                light: "#ffffff"
            }
        });

        // 3. Renderiza o HTML
        const html = `
        <!DOCTYPE html>
        <html lang="pt-br">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Pagamento PixGG</title>
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                    background-color: #f3f4f6;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 100vh;
                    margin: 0;
                }
                .card {
                    background: white;
                    padding: 2rem;
                    border-radius: 12px;
                    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
                    text-align: center;
                    max-width: 400px;
                    width: 90%;
                }
                h1 { color: #111827; font-size: 1.5rem; margin-bottom: 0.5rem; }
                .price { color: #059669; font-size: 2rem; font-weight: bold; margin: 0.5rem 0; }
                .qr-container { margin: 1.5rem 0; display: flex; justify-content: center; }
                img { max-width: 100%; height: auto; border: 1px solid #e5e7eb; border-radius: 8px; }
                .input-group { position: relative; display: flex; gap: 8px; margin-top: 1rem; }
                input {
                    width: 100%;
                    padding: 10px;
                    border: 1px solid #d1d5db;
                    border-radius: 6px;
                    background: #f9fafb;
                    color: #6b7280;
                    font-size: 0.875rem;
                    outline: none;
                }
                button {
                    background-color: #2563eb;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 6px;
                    cursor: pointer;
                    font-weight: 600;
                    transition: background 0.2s;
                    white-space: nowrap;
                }
                button:hover { background-color: #1d4ed8; }
                button:active { transform: scale(0.98); }
                .success-msg { color: #059669; font-size: 0.875rem; margin-top: 0.5rem; height: 20px; opacity: 0; transition: opacity 0.3s; }
                .footer { font-size: 0.75rem; color: #9ca3af; margin-top: 1rem; }
            </style>
        </head>
        <body>
            <div class="card">
                <h1>Pagar com Pix</h1>
                <div class="price">R$ ${valor.toFixed(2).replace('.', ',')}</div>
                <p style="color: #6b7280; font-size: 0.9rem;">Abra o app do seu banco e escaneie</p>
                
                <div class="qr-container">
                    <img src="${qrCodeDataURL}" alt="QR Code Pix" />
                </div>

                <div class="input-group">
                    <input type="text" id="pixCopyPaste" value="${pixCode}" readonly />
                    <button onclick="copyToClipboard()">Copiar Código</button>
                </div>
                <div id="msg" class="success-msg">Copiado para a área de transferência!</div>
                
                <div class="footer">ID Transação: ${result.data.transactionId}</div>
            </div>

            <script>
                function copyToClipboard() {
                    const copyText = document.getElementById("pixCopyPaste");
                    copyText.select();
                    copyText.setSelectionRange(0, 99999); /* Para mobile */
                    
                    navigator.clipboard.writeText(copyText.value).then(() => {
                        const msg = document.getElementById("msg");
                        msg.style.opacity = "1";
                        setTimeout(() => { msg.style.opacity = "0"; }, 2000);
                    }).catch(err => {
                        console.error('Erro ao copiar', err);
                        alert('Não foi possível copiar automaticamente. Por favor, copie manualmente.');
                    });
                }
            </script>
        </body>
        </html>
        `;

        res.send(html);

    } catch (error) {
        console.error(error);
        res.status(500).send(`
            <div style="font-family: sans-serif; text-align: center; padding: 2rem;">
                <h1>Erro ao gerar Pix</h1>
                <p style="color: red;">${error.message}</p>
                <p>Verifique o console do servidor.</p>
            </div>
        `);
    }
});

app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
    console.log(`Teste acessando: http://localhost:${PORT}/pix/10.90`);
});