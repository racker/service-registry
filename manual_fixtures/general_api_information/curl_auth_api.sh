curl -X POST https://identity.api.rackspacecloud.com/v2.0/tokens -d
'{ "auth":{ "RAX-KSKEY:apiKeyCredentials":{ "username":"theUserName", "apiKey":"00a00000a000a0000000a000a00aaa0a" } } }' -H "Content-type: application/json"
