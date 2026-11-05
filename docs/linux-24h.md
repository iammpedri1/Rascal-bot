# Rascal no Linux: serviço local e hospedagem gratuita

## Serviço local no Linux Mint

A instalação cria um serviço de usuário do systemd, reiniciado automaticamente em falhas. Na pasta do projeto:

```bash
npm run service:install
```

O computador precisa permanecer ligado e conectado à internet. Para iniciar o serviço após sair da sessão e após reiniciar o PC, habilite o lingering uma vez:

```bash
sudo loginctl enable-linger "$USER"
```

Ver logs e estado:

```bash
systemctl --user status rascal-bot
journalctl --user -u rascal-bot -f
```

Remover o serviço, mantendo dados e `.env`:

```bash
npm run service:uninstall
```

O SQLite e os JSON persistentes ficam em `data/` por padrão, fora de `dist/`, para que novas compilações não os apaguem.

## VM gratuita na nuvem

Uma opção gratuita com VM é OCI Always Free. Crie a conta e a VM no painel da OCI, conecte por SSH e instale Node.js 22+, Git e as dependências nativas do `better-sqlite3`. Envie o repositório para a VM, configure `.env`, execute `npm ci`, `npm run register` e `npm run service:install`.
Para execução manual, `npm start` compila, publica os slash commands e inicia o bot em uma única etapa.

A oferta depende de capacidade da região e conta; a Oracle pode recuperar VMs Always Free que considerar ociosas. Portanto, “grátis e 24/7 garantido” não é uma promessa segura. Faça backup regular de `data/` antes de atualizações.

Render Free não é indicado para este bot com SQLite local: serviços Web gratuitos hibernam por inatividade, não há plano gratuito para Background Worker e o sistema de arquivos local é efêmero.
