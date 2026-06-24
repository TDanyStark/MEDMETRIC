$Config = @{
    # FTP (reservado, no usado actualmente)
    FtpHost = ""
    FtpPort = 21
    FtpUser = ""
    FtpPass = ""

    # SSH
    SshHost = "TU_IP_SERVIDOR"
    SshPort = 65002
    SshUser = "uXXXXXXXXX"
    SshPass = "TU_PASSWORD"

    # Host key del servidor (formato plink -hostkey).
    # Obtenerlo con:
    #   ssh-keyscan -p 65002 -t ed25519 TU_IP   (luego calcular el SHA256)
    # o dejarlo vacio la primera vez y confirmar manualmente.
    SshHostKey = "ssh-ed25519 255 SHA256:XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"

    # Ruta absoluta del sitio en el servidor (frontend en raiz, backend en /api)
    RemotePath = "/home/uXXXXXXXXX/domains/tudominio.com/public_html/subdomain_xxx"

    # Entradas que NUNCA se borran al limpiar la raiz (ademas de 'api')
    KeepEntries = @(
        ".well-known"
    )
}
