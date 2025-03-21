import { v6 as uuidv6 } from 'uuid';
import { DataType, Job, JobCategory, JobType, Parameter, Project, Task } from "../../interface";
import { FUNIQUE_GS4_V2_BLEND_PREPARE, FUNIQUE_GS4_V2_COLMAP_COPY, FUNIQUE_GS4_V2_PLYDone } from '../lua/GS4_V2';
import { GetFUNIQUE_GS4ProjectTemplate_Checker, GetFUNIQUE_GS4ProjectTemplate_Colmap, GetFUNIQUE_GS4ProjectTemplate_Denoise, GetFUNIQUE_GS4ProjectTemplate_IFrame, GetFUNIQUE_GS4ProjectTemplate_IFrameBackup, GetFUNIQUE_GS4ProjectTemplate_Prepare } from './GS4';

// 排序改變 優化品質做的準備
// Colmap 的結構複製一個負的出來
const GetFUNIQUE_GS4ProjectTemplate_BlendPrepare = ():Task => {
    const copyhelper:Job = {
        uuid: uuidv6(),
        category: JobCategory.Execution,
        type: JobType.LUA,
        lua: FUNIQUE_GS4_V2_COLMAP_COPY,
        string_args: [],
        number_args: [],
        boolean_args: []
    }
    const copyhelper2:Job = {
        uuid: uuidv6(),
        category: JobCategory.Execution,
        type: JobType.LUA,
        lua: FUNIQUE_GS4_V2_BLEND_PREPARE,
        string_args: [],
        number_args: [],
        boolean_args: []
    }
    const t:Task = {
        uuid: uuidv6(),
        title: "排序改變, 負向準備",
        description: "優化品質複製, Colmap 結構準備負方向的",
        cronjob: false,
        cronjobKey: "",
        multi: false,
        multiKey: "",
        properties: [],
        jobs: [
            copyhelper,
            copyhelper2
        ]
    }
    return t
}

// Blend 生成多個 checkpoint 資料夾 (正)
const GetFUNIQUE_GS4ProjectTemplate_Checkpoint_Position = ():Task => {
    const command1:Job = {
        uuid: uuidv6(),
        category: JobCategory.Execution,
        type: JobType.COMMAND,
        lua: "",
        string_args: ["%videogs%", "conda", "run --no-capture-output -n %conda_env% python train_sequence_Good_Full_Train_densify_until_2000_i7000.py --start %gap_value% --end %frameCount_p% --cuda 0 --iframe 0 --data %root%/%after%/DATASET_P_%blend_value% --output %root%/%after%/BLEND_%blend_value%_IP/ --sh 3 --interval 1 --group_size %gap_p% --resolution 1"],
        number_args: [],
        boolean_args: []
    }
    const t:Task = {
        uuid: uuidv6(),
        title: "Blend 資料準備 (正)",
        description: "生成多個 checkpoint 資料夾",
        cronjob: true,
        cronjobKey: "blend",
        multi: false,
        multiKey: "",
        properties: [
            {
                name: 'gap_value',
                expression: '(ck - 1) * iframe_gap + IF( start_at_0, 0, 1 )'
            },
            {
                name: 'blend_value',
                expression: '(ck - 1) * iframe_gap'
            },
            {
                name: 'frameCount_p',
                expression: 'data_p__ck_'
            }
        ],
        jobs: [
            command1
        ]
    }
    return t
}

// Blend 生成多個 checkpoint 資料夾 (負)
const GetFUNIQUE_GS4ProjectTemplate_Checkpoint_Negative = ():Task => {
    const command1:Job = {
        uuid: uuidv6(),
        category: JobCategory.Execution,
        type: JobType.COMMAND,
        lua: "",
        string_args: ["%videogs%", "conda", "run --no-capture-output -n %conda_env% python train_sequence_Good_Full_Train_densify_until_2000_i7000.py --start %gap_value% --end %frameCount_n% --cuda 0 --iframe 0 --data %root%/%after%/DATASET_N_%blend_value% --output %root%/%after%/BLEND_%blend_value%_IN/ --sh 3 --interval 1 --group_size %gap_n% --resolution 1"],
        number_args: [],
        boolean_args: []
    }
    const t:Task = {
        uuid: uuidv6(),
        title: "Blend 資料準備 (負)",
        description: "生成多個 checkpoint 資料夾",
        cronjob: true,
        cronjobKey: "blend",
        multi: false,
        multiKey: "",
        properties: [
            {
                name: 'gap_value',
                expression: '(ck - 1) * iframe_gap + IF( start_at_0, 0, 1 )'
            },
            {
                name: 'blend_value',
                expression: '(ck - 1) * iframe_gap'
            },
            {
                name: 'frameCount_n',
                expression: 'data_n__ck_'
            }
        ],
        jobs: [
            command1
        ]
    }
    return t
}

// 生成 ply 序列!!
const GetFUNIQUE_GS4ProjectTemplate_PlyList = ():Task => {
    const sequenceJob:Job = {
        uuid: uuidv6(),
        category: JobCategory.Execution,
        type: JobType.LUA,
        lua: FUNIQUE_GS4_V2_PLYDone,
        string_args: [],
        number_args: [],
        boolean_args: []
    }
    const t:Task = {
        uuid: uuidv6(),
        title: "Ply 輸出",
        description: "生成 ply 序列!!",
        cronjob: false,
        cronjobKey: "",
        multi: false,
        multiKey: "",
        properties: [],
        jobs: [
            sequenceJob
        ]
    }
    return t
}

// 透明度調整
const GetFUNIQUE_GS4ProjectTemplate_Blend1 = ():Task => {
    const transparentJob:Job = {
        uuid: uuidv6(),
        category: JobCategory.Execution,
        type: JobType.COMMAND,
        lua: "",
        string_args: ["%output%", "ply_blend", "-t 0 -f %index% -b %blend% -g %iframe_gap% -c %contribute% -r %output%/raw -o %output%/trans"],
        number_args: [],
        boolean_args: []
    }
    const t:Task = {
        uuid: uuidv6(),
        title: "Blending 程序 透明度調整",
        description: "Ply 透明度調整",
        cronjob: true,
        cronjobKey: "frameCount",
        multi: false,
        multiKey: "",
        properties: [
            {
                name: 'index',
                expression: '(ck - 1) + IF( start_at_0, 0, 1 )'
            }
        ],
        jobs: [
            transparentJob
        ]
    }
    return t
}

// 合併
const GetFUNIQUE_GS4ProjectTemplate_Blend2 = ():Task => {
    const mergeJob:Job = {
        uuid: uuidv6(),
        category: JobCategory.Execution,
        type: JobType.COMMAND,
        lua: "",
        string_args: ["%output%", "ply_blend", "-t 1 -f %index% -b %blend% -g %iframe_gap% -c %contribute% -r %output%/trans -o %output%/final"],
        number_args: [],
        boolean_args: []
    }
    const t:Task = {
        uuid: uuidv6(),
        title: "Blending 程序 合成",
        description: "Ply 多序包裝成單序",
        cronjob: true,
        cronjobKey: "frameCount",
        multi: false,
        multiKey: "",
        properties: [
            {
                name: 'index',
                expression: '(ck - 1) + IF( start_at_0, 0, 1 )'
            }
        ],
        jobs: [
            mergeJob
        ]
    }
    return t
}

export const GetFUNIQUE_GS4Project_V2_Template = (r:Project):Project => {
    const para:Parameter = {
        canWrite: true,
        containers: [
            { name: "frameCount", value: 20, type: DataType.Number, runtimeOnly: false, hidden: false },
            { name: "iframe_gap", value: 5, type: DataType.Number, runtimeOnly: false, hidden: false },
            { name: "lut_thread", value: 5, type: DataType.Number, runtimeOnly: false, hidden: false },
            { name: "group_size", value: 20, type: DataType.Number, runtimeOnly: false, hidden: false },
            { name: "blend", value: 4, type: DataType.Number, runtimeOnly: false, hidden: false },
            { name: "contribute", value: 2, type: DataType.Number, runtimeOnly: false, hidden: false },
            { name: "iframe_size", value: 0, type: DataType.Number, runtimeOnly: false, hidden: false },
            { name: "denoise", value: 0, type: DataType.Number, runtimeOnly: false, hidden: false },

            { name: "root", value: "G:/Developer/Funique/4DGS/Test", type: DataType.String, runtimeOnly: false, hidden: false },
            { name: "output", value: "G:/Developer/Funique/4DGS/Test/out", type: DataType.String, runtimeOnly: false, hidden: false },
            { name: "prepare", value: "Prepare", type: DataType.String, runtimeOnly: false, hidden: true },
            { name: "before", value: "before", type: DataType.String, runtimeOnly: false, hidden: true },
            { name: "after", value: "after", type: DataType.String, runtimeOnly: false, hidden: true },
            { name: "CAM", value: "CAM", type: DataType.String, runtimeOnly: false, hidden: true },
            { name: "images", value: "images", type: DataType.String, runtimeOnly: false, hidden: true },
            { name: "sparse", value: "sparse", type: DataType.String, runtimeOnly: false, hidden: true },
            { name: "videogs", value: "C:/videogs/VideoGS", type: DataType.String, runtimeOnly: false, hidden: false },
            { name: "conda_env", value: "videogs", type: DataType.String, runtimeOnly: false, hidden: false },

            { name: "start_at_0", value: false, type: DataType.Boolean, runtimeOnly: false, hidden: false },
        ]
    }
    r.parameter = para
    r.task.push(...[
        GetFUNIQUE_GS4ProjectTemplate_Checker(),
        GetFUNIQUE_GS4ProjectTemplate_Prepare(),
        GetFUNIQUE_GS4ProjectTemplate_Colmap(),
        GetFUNIQUE_GS4ProjectTemplate_IFrame(),
        GetFUNIQUE_GS4ProjectTemplate_IFrameBackup(),
        GetFUNIQUE_GS4ProjectTemplate_Denoise(),
        GetFUNIQUE_GS4ProjectTemplate_BlendPrepare(),
        GetFUNIQUE_GS4ProjectTemplate_Checkpoint_Position(),
        GetFUNIQUE_GS4ProjectTemplate_Checkpoint_Negative(),
        GetFUNIQUE_GS4ProjectTemplate_PlyList(),
        GetFUNIQUE_GS4ProjectTemplate_Blend1(),
        GetFUNIQUE_GS4ProjectTemplate_Blend2()
    ])
    return r
}