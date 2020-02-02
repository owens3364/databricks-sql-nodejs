const { expect } = require('chai');
const KerberosTcpAuthentication = require('../../../../dist/connection/auth/KerberosTcpAuthentication').default;

const getTransportMock = () => {
    let cursor = 0;
    let dataChecks = [
        (data) => {
            expect(data.toString()).to.be.eq(Buffer.concat([
                Buffer.from([ 1, 0, 0, 0, 6 ]),
                Buffer.from('GSSAPI')
            ]).toString());
        },
        (data) => {
            expect(data.toString()).to.be.eq(Buffer.concat([
                Buffer.from([ 2, 0, 0, 0, 5 ]),
                Buffer.from('token')
            ]).toString());
        },
        (data) => {
            expect(data.toString()).to.be.eq(Buffer.concat([
                Buffer.from([ 2, 0, 0, 0, 11 ]),
                Buffer.from('transition1')
            ]).toString());
        },
        (data) => {
            expect(data.toString()).to.be.eq(Buffer.concat([
                Buffer.from([ 2, 0, 0, 0, 5 ]),
                Buffer.from([1, 0, 0, 0, 4])
            ]).toString());
        },
    ];

    return {
        listeners: {},
        connect() {},
        addListener(name, cb) {
            this.listeners[name] = cb;
        },
        write(data) {
            dataChecks[cursor](data);
            cursor++;
        },
        removeListener() {},
        end() {},
    };
};

const getKerberosClientMock = () => {
    return {
        wrap(payload, data, cb) {
            expect(payload).to.be.eq(Buffer.from([1, 0, 0, 0, 4]).toString('base64'));
            return cb(null, payload);
        },
        unwrap(payload, cb) {
            expect(Buffer.from(payload, 'base64').toString()).to.be.eq('transition2');
            return cb(null, Buffer.from([1, 0, 0, 0, 4]).toString('base64'));
        },
    };
};

const getAuthProcessMock = () => {
    let cursor = 0;
    const transitions = [
        [ '', 'token' ],
        [ 'transition1', 'transition1' ]
    ];
    
    return {
        init(username, password, cb) {
            expect(username).to.be.eq('hive/hive.driver@EXAMPLE.COM');
            expect(password).to.be.eq('hive');
            return cb(null, getKerberosClientMock());
        },
        transition(payload, cb) {
            const data = transitions[cursor++];
            expect(payload).to.be.eq(Buffer.from(data[0]).toString('base64'));
            return cb(null, Buffer.from(data[1]).toString('base64'));
        }
    };
};

describe('KerberosTcpAuthentication', () => {
    it('username and password must be defined correctly', () => {
        const auth = new KerberosTcpAuthentication({
            username: 'user',
            password: 'pass'
        });

        expect(auth.username).to.be.eq('user');
        expect(auth.password).to.be.eq('pass');
    });

    it('empty password must be set', () => {
        const auth = new KerberosTcpAuthentication({
            username: 'user',
            password: ''
        });

        expect(auth.username).to.be.eq('user');
        expect(auth.password).to.be.eq('');
    });

    it('sasl process must be passed', () => {
        const authProcess = getAuthProcessMock();
        const transportMock = getTransportMock();
        const auth = new KerberosTcpAuthentication(
            {
                username: 'hive/hive.driver@EXAMPLE.COM',
                password: 'hive'
            },
            authProcess
        );
        const result = auth.authenticate(transportMock);

        return Promise.resolve().then(() => {
            transportMock.listeners.connect();
        }).then(() => {
            transportMock.listeners.data(Buffer.concat([
                Buffer.from([ 2, 0, 0, 0, 11 ]),
                Buffer.from('transition1')
            ]));
        }).then(() => {
            transportMock.listeners.data(Buffer.concat([
                Buffer.from([ 2, 0, 0, 0, 12 ]),
                Buffer.from('transition2')
            ]));
        }).then(() => {
            transportMock.listeners.data(Buffer.from([ 5 ]));

            return result;
        }).then((transport) => {
            expect(transport).to.be.eq(transportMock);
        });
    });

    it('the error must be thrown if response incorrect', () => {
        const authProcess = getAuthProcessMock();
        const auth = new KerberosTcpAuthentication({
            username: 'hive/hive.driver@EXAMPLE.COM',
            password: 'hive'
        }, authProcess);
        const transportMock = getTransportMock();
        const result = auth.authenticate(transportMock);

        return Promise.resolve().then(() => {
            transportMock.listeners.connect();
        }).then(() => {
            transportMock.listeners.data(Buffer.concat([
                Buffer.from([ 4, 0, 0, 0, 10 ]),
                Buffer.from('auth error')
            ]));

            return result;
        }).catch((error) => {
            expect(error.message).to.be.eq('Authentication error: auth error');
        });
    });
});
