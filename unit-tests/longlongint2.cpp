#include <iostream>
#include <string>

using namespace std;

int main() {
    long long int a = stoll("-7431748451693704736");
    cout << a << endl;
    cout << to_string(a) << endl;
    
    unsigned long long int b = stoull("14863496903387409472");
    cout << b << endl;
    cout << to_string(b) << endl;
}

