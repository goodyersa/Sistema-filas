// Variável de controle de áudio
let audioAtivado = false;
// Variável para armazenar o timestamp da última vez que o áudio tocou
let lastPlayedTimestamp = 0;
// NOVA BANDEIRA: Impede que a função de atualização seja executada mais de uma vez ao mesmo tempo
let isPolling = false;

// FUNÇÃO AUXILIAR: Encadeia a reprodução dos arquivos de áudio
function playSequence(audioFiles) {
    if (!audioAtivado || audioFiles.length === 0) return Promise.resolve();

    const nextFile = audioFiles.shift();
    
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            const audio = new Audio(nextFile);
            
            audio.onended = () => {
                // Se ainda houver mais arquivos, continua a sequência
                if (audioFiles.length > 0) {
                     playSequence(audioFiles).then(resolve).catch(reject);
                } else {
                    // Se for o último, resolve a Promise final
                    resolve();
                }
            };

            audio.onerror = (e) => {
                console.error(`Erro ao carregar ou reproduzir o arquivo: ${nextFile}`, e);
                // Continua a sequência mesmo que um arquivo falhe
                if (audioFiles.length > 0) {
                     playSequence(audioFiles).then(resolve).catch(reject);
                } else {
                    resolve();
                }
            };

            audio.play().catch(e => {
                console.error(`Falha ao iniciar a reprodução de ${nextFile}`, e);
                // Continua a sequência
                if (audioFiles.length > 0) {
                     playSequence(audioFiles).then(resolve).catch(reject);
                } else {
                    resolve();
                }
            });
        }, 50); // 50ms de pausa entre os arquivos
    });
}

// FUNÇÃO: Monta a sequência de áudios e inicia a reprodução (dígito por dígito)
function fazerChamadaVoz(senhaCompleta, triagem) {
    if (!audioAtivado) return Promise.resolve(); 

    // 1. Extrai as partes
    const tipoLetra = senhaCompleta.slice(0, 1);
    const numeroSenhaString = senhaCompleta.slice(1);
    
    // 2. Define os arquivos de áudio
    const tipoAudio = tipoLetra === 'N' ? 'normal.mp3' : 'preferencial.mp3';
    const letraAudio = `/${tipoLetra.toLowerCase()}.mp3`; 

    // Divide o número em dígitos e cria uma lista de arquivos de áudio
    const digitosAudio = Array.from(numeroSenhaString).map(d => `/${d}.mp3`); 
    
    // 3. Monta a sequência completa de chamada
    const sequencia = [
        '/chamando.mp3',
        `/${tipoAudio}`,
        letraAudio,
        ...digitosAudio
    ];

    // 4. Inicia a reprodução
    return playSequence(sequencia);
}


// Função para ativar o áudio com interação do utilizador
function ativarAudio() {
    if (audioAtivado) return;
    try {
        const audio = new Audio('/1.mp3'); 
        if (!audio) {
            audio = new Audio('/ding.mp3');
        }
        
        const playPromise = audio.play();
        if (playPromise !== undefined) {
            playPromise.then(() => {
                audioAtivado = true;
                localStorage.setItem('audioAtivado', 'true');
                const ativarAudioBtn = document.getElementById('ativar-audio-btn');
                if (ativarAudioBtn) {
                    ativarAudioBtn.classList.add('hidden');
                }
                alert('Áudio ativado com sucesso!');
            }).catch(e => {
                console.error("Erro ao tentar ativar o áudio:", e);
                alert('Não foi possível ativar o áudio. Por favor, clique no botão e verifique as permissões do seu navegador.');
            });
        }
    } catch (e) {
        console.error("Erro ao criar objeto de áudio:", e);
        alert('Não foi possível ativar o áudio. Verifique as configurações do seu navegador.');
    }
}
        
// As demais funções de API e controle de tela
async function atualizarPainelExibicao() {
    // CORREÇÃO: Se já estiver a correr, sai imediatamente
    if (isPolling) return; 
    
    isPolling = true; // Inicia o bloqueio

    try {
        const response = await fetch('/api/estatisticas');
        const data = await response.json();
        
        // Verifica se o timestamp do servidor é mais recente que o último que tocámos
        if (data.lastAudioTimestamp > lastPlayedTimestamp) {
            // USAMOS AWAIT: O código para aqui até o áudio terminar
            await fazerChamadaVoz(data.chamadaAtual.senha, data.chamadaAtual.triagem); 
            
            // ATUALIZAÇÃO CRUCIAL: Apenas atualiza o estado DEPOIS de o áudio ter terminado
            lastPlayedTimestamp = data.lastAudioTimestamp;
        }

        if (document.getElementById('contador-senhas')) {
            document.getElementById('contador-senhas').textContent = data.totalFilas;
        }
        if (document.getElementById('total-geral')) {
            document.getElementById('total-geral').textContent = data.totalGeral;
        }
        
        // Mostra a senha completa
        if (document.getElementById('senha-painel')) {
            if (data.chamadaAtual) {
                document.getElementById('senha-painel').textContent = data.chamadaAtual.senha;
                document.getElementById('triagem-completa').textContent = data.chamadaAtual.triagem.toUpperCase();
            } else {
                document.getElementById('senha-painel').textContent = '--';
                document.getElementById('triagem-completa').textContent = '--';
            }
        }
        
        // Mostra as últimas senhas completas
        const ultimasSenhasContainer = document.getElementById('antigos-senhas-container');
        if (ultimasSenhasContainer) {
            ultimasSenhasContainer.innerHTML = '';
            data.ultimasChamadas.slice(0, 3).forEach(chamada => {
                const senhaBox = document.createElement('div');
                senhaBox.className = 'senha-box-antiga';
                
                const numeroSpan = document.createElement('span');
                numeroSpan.className = 'senha-antiga-numero';
                numeroSpan.textContent = chamada.senha;

                const triagemSpan = document.createElement('span');
                triagemSpan.className = 'senha-antiga-triagem';
                triagemSpan.textContent = chamada.triagem;

                senhaBox.appendChild(numeroSpan);
                senhaBox.appendChild(triagemSpan);
                ultimasSenhasContainer.appendChild(senhaBox);
            });
        }
    } catch (error) {
        console.error('Erro ao buscar estatísticas para o painel:', error);
    } finally {
        isPolling = false; // Libera o bloqueio
    }
}

function imprimirSenha(senha, tipo) {
    const conteudoImpressao = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Imprimir Senha</title>
            <style>
                @page {
                    size: 80mm 50mm;
                    margin: 0;
                }
                body {
                    width: 80mm;
                    height: 50mm;
                    font-family: 'Courier New', Courier, monospace;
                    text-align: center;
                    margin: 0;
                    padding: 5mm;
                    box-sizing: border-box;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;
                }
                h1 {
                    font-size: 1.5em;
                    margin: 5px 0;
                }
                h2 {
                    font-size: 2em;
                    margin: 10px 0;
                }
                p {
                    font-size: 0.8em;
                    margin: 2px 0;
                }
            </style>
        </head>
        <body onload="window.print(); window.close();">
            <h1 style="font-size: 1.2em;">CENTRO MEDICO VILA NORTE</h1>
            <p>Sua Senha:</p>
            <h2 style="font-size: 3em; margin: 0; padding: 0;">${senha}</h2>
            <p>Categoria: ${tipo}</p>
        </body>
        </html>
    `;
    const janelaImpressao = window.open('', '');
    janelaImpressao.document.write(conteudoImpressao);
    janelaImpressao.document.close();
}


async function gerarSenha(tipo) {
    try {
        const response = await fetch('/api/gerar-senha', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tipo: tipo })
        });

        if (!response.ok) {
            throw new Error('Erro ao gerar senha.');
        }

        const data = await response.json();
        const senhaGerada = data.senha;
        const tipoSenha = data.tipo;

        document.getElementById('ultima-senha-totem').textContent = `Senha gerada: ${senhaGerada} (${tipoSenha})`;
        
        imprimirSenha(senhaGerada, tipoSenha);

        await atualizarPainelExibicao();
    } catch (error) {
        console.error('Erro:', error);
        alert('Não foi possível gerar a senha. Verifique se o servidor está online.');
    }
}


async function chamarProximaSenha() {
    try {
        const triagemSelecionada = document.getElementById('triagem-selecionada-info').textContent.split(': ')[1];
        const response = await fetch('/api/chamar-proxima', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ triagem: triagemSelecionada })
        });
        
        if (response.status === 404) {
            alert('Não há senhas na fila.');
            return;
        }
        
        if (!response.ok) {
            throw new Error('Erro ao chamar a próxima senha.');
        }

        const data = await response.json();
        document.getElementById('senha-atendida').textContent = data.senha;
        document.getElementById('triagem-operador').textContent = `Triagem: ${data.triagem}`;
        
        await atualizarPainelExibicao();
    } catch (error) {
        console.error('Erro:', error);
        alert('Não foi possível chamar a próxima senha. Verifique se o servidor está online.');
    }
}

async function rechamarSenha() {
    try {
        const triagemSelecionada = document.getElementById('triagem-selecionada-info').textContent.split(': ')[1];
        const response = await fetch('/api/rechamar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ triagem: triagemSelecionada })
        });

        if (response.status === 404) {
            alert('Nenhuma senha para rechamar.');
            return;
        }

        if (!response.ok) {
            throw new Error('Erro ao rechamar a senha.');
        }

        const data = await response.json();
        
        await atualizarPainelExibicao();
    } catch (error) {
        console.error('Erro:', error);
        alert('Não foi possível rechamar a senha. Verifique se o servidor está online.');
    }
}

async function resetarSenhas() {
    if (confirm("Tem certeza que deseja reiniciar a contagem das senhas? O contador total não será afetado.")) {
        try {
            const response = await fetch('/api/resetar-senhas', { method: 'POST' });
            if (!response.ok) {
                throw new Error('Erro ao reiniciar as senhas.');
            }
            const data = await response.json();
            alert(data.mensagem);
            await atualizarPainelExibicao();
        } catch (error) {
            console.error('Erro:', error);
            alert('Não foi possível reiniciar as senhas. Verifique se o servidor está online.');
        }
    }
}

function selecionarTriagem(triagem) {
    const triagemInfo = document.getElementById('triagem-selecionada-info');
    if (triagemInfo) {
        triagemInfo.innerHTML = `Triagem Selecionada: **${triagem}**`;
        const triagem1Btn = document.getElementById('triagem1-btn');
        const triagem2Btn = document.getElementById('triagem2-btn');
        if (triagem1Btn) triagem1Btn.classList.remove('active');
        if (triagem2Btn) triagem2Btn.classList.remove('active');
        document.getElementById(triagem === 'Triagem 1' ? 'triagem1-btn' : 'triagem2-btn').classList.add('active');
    }
}

function init() {
    if (localStorage.getItem('audioAtivado') === 'true') {
        audioAtivado = true;
    }

    const ativarAudioBtn = document.getElementById('ativar-audio-btn');
    if (ativarAudioBtn && audioAtivado) {
        ativarAudioBtn.classList.add('hidden');
    }

    // Chamada inicial e depois o intervalo
    atualizarPainelExibicao();
    setInterval(atualizarPainelExibicao, 3000);
}

document.addEventListener('DOMContentLoaded', init);