module.exports = {
    deployToDevice: function (gulp, plugins, config) {
        return function () {
            return gulp
                .src([
                    './package.json',
                    './apps/' + config.projectName + '/*.{js,json}',
                    './apps/' + config.projectName + '/readme.md',
                    './common/*.{js,json}',
                    '!gulpfile.js'])
                .pipe(plugins.scp2({
                    host: config.host,
                    username: config.user,
                    password: config.password,
                    dest: config.projectName
                }))
                .on('error', function (err) {
                    console.log('ERR: ' + err);
                });
        };
    },

    // kill all running processes for this app
    killProcesses: function (gulp, plugins, config) {
        return (function () {
            var cmd = 'kill -9 $(ps | grep "/home/{user}/{projectName}/app.js"'.format(config)
                + ' | grep -v grep | awk \'{ print $1 }\')',
                ssh = new plugins.ssh2.Client(),
                cb = this.sshCallback_.bind(this, ssh),
                promise = new Promise(function (resolve, reject) {
                    ssh
                        .on('ready', function () {
                            console.log(cmd);
                            ssh.exec(cmd, cb);
                        })
                        .on('end', function () {
                            resolve();
                        })
                        .on('error', function (err) {
                            console.log('!Error!');
                            reject(err);
                        })
                        .connect({
                            host: config.host,
                            port: config.sshPort,
                            username: config.user,
                            password: config.password
                        });
                });

            return promise;
        }).bind(this);
    },

    restorePackages: function (gulp, plugins, config) {
        return (function () {
            var cmd = '/usr/bin/node /usr/bin/npm --prefix ./{projectName} install ./{projectName} --production;'.format(config),
                ssh = new plugins.ssh2.Client(),
                cb = this.sshCallback_.bind(this, ssh),
                promise = new Promise(function (resolve, reject) {
                    ssh.on('ready', function () {
                        ssh.exec(cmd, cb);
                    })
                        .on('end', function () {
                            resolve();
                        })
                        .on('error', function (err) {
                            console.log('!Error!');
                            reject(err);
                        })
                        .connect({
                            host: config.host,
                            port: config.sshPort,
                            username: config.user,
                            password: config.password
                        });
                });

            return promise;
        }).bind(this);
    },

    setStartup: function (gulp, plugins, config) {
        return function () {
            var appFolder = '/home/{0}/{1}'.format(config.user, config.projectName),
                starter = '/usr/bin/node ' + (config.isDebug ? '{0}/RemoteDebug.js {0}/app.js' : '{0}/app.js').format(appFolder),
                ssh = new plugins.ssh2.Client(),
                cb = this.sshCallback_.bind(this, ssh),
                serviceText =
                    "[Unit]\n" +
                    "    Description = Node startup app service for starting a node process\n" +
                    "    After = mdns.service\n" +
                    "[Service]\n" +
                    "    ExecStart = " + starter + "\n" +
                    "    Restart = on-failure\n" +
                    "    RestartSec = 2s\n" +
                    "    Environment=NODE_PATH=/usr/lib/node_modules\n" +
                    "[Install]\n" +
                    "    WantedBy=default.target\n",
                promise = new Promise(function (resolve, reject) {
                    ssh
                        .on('ready', function () {
                            ssh.exec('systemctl stop nodeup.service;' +
                                'echo "' + serviceText + '" > /etc/systemd/system/nodeup.service;' +
                                'systemctl daemon-reload;' +
                                'systemctl enable nodeup.service;' +
                                'systemctl start nodeup.service', cb);
                        })
                        .on('end', function () {
                            resolve();
                        })
                        .on('error', function (err) {
                            console.log('!Error!');
                            reject(err);
                        })
                        .connect({
                            host: config.host,
                            port: config.sshPort,
                            username: config.user,
                            password: config.password
                        });
                });

            return promise;
        }.bind(this);
    },

    sshCallback_: function (ssh, err, stream) {
        if (err) throw err;
        stream
            .on('close', function (code, signal) {
                console.log('Stream closed with code ' + code + ' and signal ' + signal);
                ssh.end();
            })
            .on('data', function (data) {
                console.log(data);
            })
            .stderr.on('data', function (err) {
                console.log('Error: ' + err);
            });
    }
};