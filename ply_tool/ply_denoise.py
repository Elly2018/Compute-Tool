import numpy as np
import argparse
import os
import sys
from plyfile import PlyData, PlyElement, PlyProperty, PlyListProperty

def calculate_rgb(f_dc_0, f_dc_1, f_dc_2):
    SH_C0 = 0.28209479177387814
    r = 0.5 + SH_C0 * f_dc_0
    g = 0.5 + SH_C0 * f_dc_1
    b = 0.5 + SH_C0 * f_dc_2
    return r, g, b

# get arguments
parser = argparse.ArgumentParser()
parser.add_argument('-i', '--input', help='input ply file')
parser.add_argument('-o', '--output', help='output ply file')
args = parser.parse_args()
input_file = args.input
output_file = args.output

if input_file is None:
    print ("please specify input ply file")
    sys.exit()
if output_file is None:
    print ("please specify output ply file")
    sys.exit()

if os.path.isfile('temp.ply'):
    os.remove('temp.ply')

if os.path.isfile(output_file):
    os.remove(output_file)

data = PlyData.read(input_file)
three_index = [0, 0, 0]
result = []
dtype = data.elements[0].properties
print('dtype count: ' + str(len(dtype)))

for i, x in enumerate(dtype):
    props = str(x).split(' ')
    if props[2] == "f_dc_0":
        three_index[0] = i
    elif props[2] == "f_dc_1":
        three_index[1] = i
    elif props[2] == "f_dc_2":
        three_index[2] = i


data.text = True
data.write('temp.ply')
count = 0
with open('temp.ply', 'r') as f:
    for i, line in enumerate(f):
        if(i < len(dtype) + 4):
            result.append(line)
        else:
            numbers = line.split(' ')
            ispass = False
            dc_1 = float(numbers[three_index[0]])
            dc_2 = float(numbers[three_index[1]])
            dc_3 = float(numbers[three_index[2]])
            r, g, b = calculate_rgb(dc_1, dc_2, dc_3)
            ispass = r > 0 and g > 0 and b > 0
            if ispass:
                result.append(line)
                count = count + 1
    pass

result[2] = 'element vertex ' + str(count) + '\n'

os.remove('temp.ply')

with open('temp.ply', 'w') as f:
    f.write(''.join(result))

data = PlyData.read('temp.ply')
data.text = False
data.write(output_file)
os.remove('temp.ply')


