// Importa os módulos Express e CORS
const express = require('express');
const cors = require('cors');
const app = express();
const PORT = 3000;

// Importa o módulo do SQLite
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database.sqlite');

// Middleware para processar JSON e habilitar CORS
app.use(express.json());
app.use(cors());

const path = require('path');
app.use(express.static(path.join(__dirname, 'public')));

// Variáveis de estado do sistema
let proximaSenhaNormal = 1;
let proximaSenhaPreferencial = 1;
let filaNormal = [];
let filaPreferencial = [];
let prioridadePreferencial = 0;
let chamadaAtual = null;
let totalSenhasGeral = 0;

// Array para armazenar as últimas 5 senhas chamadas
let ultimasChamadas = [];

// Variável para controlar o áudio usando um timestamp
let lastAudioTimestamp = 0;

// Inicializa o banco de dados e carrega os contadores e o histórico
db.serialize(() => {
    // Tabela para contadores
    db.run("CREATE TABLE IF NOT EXISTS counters (key TEXT UNIQUE, value INTEGER)", (err) => {
        if (err) {
            console.error("Erro ao criar a tabela 'counters':", err);
            return;
        }
        db.get("SELECT value FROM counters WHERE key = 'totalSenhasGeral'", (err, row) => {
            if (row) totalSenhasGeral = row.value;
        });
        db.get("SELECT value FROM counters WHERE key = 'proximaSenhaNormal'", (err, row) => {
            if (row) proximaSenhaNormal = row.value;
        });
        db.get("SELECT value FROM counters WHERE key = 'proximaSenhaPreferencial'", (err, row) => {
            if (row) proximaSenhaPreferencial = row.value;
        });
        console.log("Contadores carregados do banco de dados.");
    });

    // Tabela para o histórico de chamadas
    db.run("CREATE TABLE IF NOT EXISTS chamadas_historico (id INTEGER PRIMARY KEY AUTOINCREMENT, senha TEXT, triagem TEXT, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)", (err) => {
        if (err) {
            console.error("Erro ao criar a tabela 'chamadas_historico':", err);
            return;
        }
        db.all("SELECT senha, triagem FROM chamadas_historico ORDER BY id DESC LIMIT 5", (err, rows) => {
            if (err) {
                console.error("Erro ao carregar o histórico:", err);
                return;
            }
            ultimasChamadas = rows.reverse();
            console.log("Histórico de chamadas carregado do banco de dados.");
        });
    });
});

// Função para salvar os contadores no banco de dados
function saveCounters() {
    db.run("INSERT OR REPLACE INTO counters (key, value) VALUES (?, ?)", ['totalSenhasGeral', totalSenhasGeral]);
    db.run("INSERT OR REPLACE INTO counters (key, value) VALUES (?, ?)", ['proximaSenhaNormal', proximaSenhaNormal]);
    db.run("INSERT OR REPLACE INTO counters (key, value) VALUES (?, ?)", ['proximaSenhaPreferencial', proximaSenhaPreferencial]);
}

// Rota para o Módulo do Totem: Gerar Senhas
app.post('/api/gerar-senha', (req, res) => {
    const { tipo } = req.body;
    let senhaCompleta;

    if (tipo === 'Normal') {
        const numeroSenha = proximaSenhaNormal++;
        senhaCompleta = `N${String(numeroSenha).padStart(3, '0')}`;
        filaNormal.push(senhaCompleta);
    } else if (tipo === 'Preferencial') {
        const numeroSenha = proximaSenhaPreferencial++;
        senhaCompleta = `P${String(numeroSenha).padStart(3, '0')}`;
        filaPreferencial.push(senhaCompleta);
    } else {
        return res.status(400).json({ error: 'Tipo de senha inválido.' });
    }

    totalSenhasGeral++;
    
    saveCounters();

    res.json({ senha: senhaCompleta, tipo: tipo });
});

// Rota para o Módulo do Operador: Chamar Próxima Senha
app.post('/api/chamar-proxima', (req, res) => {
    const { triagem } = req.body;
    let senhaChamada;

    if (prioridadePreferencial < 2 && filaPreferencial.length > 0) {
        senhaChamada = filaPreferencial.shift();
        prioridadePreferencial++;
    } else if (filaNormal.length > 0) {
        senhaChamada = filaNormal.shift();
        prioridadePreferencial = 0;
    } else if (filaPreferencial.length > 0) {
        senhaChamada = filaPreferencial.shift();
    } else {
        return res.status(404).json({ error: 'Não há senhas na fila.' });
    }

    if (chamadaAtual) {
        ultimasChamadas.unshift(chamadaAtual);
        if (ultimasChamadas.length > 5) {
            ultimasChamadas.pop();
        }
    }

    // Atualiza o timestamp do áudio
    lastAudioTimestamp = Date.now();

    // Insere a chamada atual no banco de dados
    db.run("INSERT INTO chamadas_historico (senha, triagem) VALUES (?, ?)", [senhaChamada, triagem], (err) => {
        if (err) {
            console.error("Erro ao salvar a chamada no histórico:", err);
        }
    });

    chamadaAtual = { senha: senhaChamada, triagem: triagem };
    res.json(chamadaAtual);
});

// Rota para o Módulo do Operador: Rechamar Senha
app.post('/api/rechamar', (req, res) => {
    const { triagem } = req.body;
    if (chamadaAtual && chamadaAtual.triagem === triagem) {
        // Atualiza o timestamp do áudio para a rechamada
        lastAudioTimestamp = Date.now();
        res.json({ mensagem: `Rechamando senha: ${chamadaAtual.senha} na Triagem ${chamadaAtual.triagem}` });
    } else {
        res.status(404).json({ error: 'Nenhuma senha para rechamar nesta triagem.' });
    }
});

// Rota para o Módulo do Administrador: Reiniciar Senhas
app.post('/api/resetar-senhas', (req, res) => {
    // Apenas reinicia os contadores, mantendo as filas existentes
    proximaSenhaNormal = 1;
    proximaSenhaPreferencial = 1;
    
    // Limpa a exibição no painel
    chamadaAtual = null;
    prioridadePreferencial = 0;
    lastAudioTimestamp = 0;
    ultimasChamadas = [];

    // Salva os contadores reiniciados no banco de dados
    saveCounters();
    
    console.log("As senhas foram reiniciadas. O contador total não foi afetado.");
    res.json({ mensagem: "As senhas foram reiniciadas com sucesso." });
});

// Rota para obter as estatísticas e contadores
app.get('/api/estatisticas', (req, res) => {
    res.json({
        totalGeral: totalSenhasGeral,
        totalFilas: filaNormal.length + filaPreferencial.length,
        chamadaAtual: chamadaAtual,
        ultimasChamadas: ultimasChamadas,
        lastAudioTimestamp: lastAudioTimestamp
    });
});

// Rota padrão que serve o arquivo admin.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Inicia o servidor
app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});