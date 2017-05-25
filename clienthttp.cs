using System;
using System.Net.Http;
using System.Text;
using System.Collections.Generic;
using GTANetworkServer;
using GTANetworkShared;

namespace kayteh.clienthttp {
    class ClientHTTP : Script {
        private static readonly HttpClient client = new HttpClient();

        public ClientHTTP() {
            API.onClientEventTrigger += processEvent;
        }

        private void processEvent(Client client, string name, params object[] args) {
            if (name != "clienthttp/request") {
                return;
            }

            ClientRequest req = new ClientRequest(client, (string)args[0], (string)args[1]);

            makeRequest(req);
        }

        private async void resolve(ClientRequest req, HttpResponseMessage response) {
            int status = (int)response.StatusCode;
            string headers = API.toJson(response.Headers);
            string data = await response.Content.ReadAsStringAsync();
            API.triggerClientEvent(req.client, "clienthttp/response", req.token, status, headers, data);
        }

        private void reject(ClientRequest req, string data) {
            API.triggerClientEvent(req.client, "clienthttp/response", req.token, 0, null, data, true);
        }

        private async void makeRequest(ClientRequest req) {
            string url = (string)req.dat.url;
            if (req.dat.method == "GET") {
                resolve(req, await client.GetAsync(url));
            } else if (req.dat.method == "DELETE") {
                resolve(req, await client.DeleteAsync(url));
            } else {
                var hrm = new HttpRequestMessage(req.dat.method, req.dat.url);
                hrm.Content = new StringContent(API.toJson(req.dat.body), Encoding.UTF8);
                foreach (KeyValuePair<string, string> header in req.dat.headers) {
                    hrm.Headers.Add(header.Key, header.Value);
                }

                hrm.Headers.Add("User-Agent", "kayteh.clienthttp/1.0 GTANetwork (+https://github.com/kayteh/clienthttp)");

                resolve(req, await client.SendAsync(hrm));
            }
        }
    }

    class ClientRequest {
        public dynamic dat;
        public string token;
        public Client client;
        public ClientRequest(Client _client, string _token, string json) {
            dat = API.shared.fromJson(json);
            token = _token;
            client = _client;
        }
    }
}