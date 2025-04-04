import { v6 as uuidv6 } from 'uuid';
import { DataType, Job, JobCategory, JobType, Parameter, Project, Task } from "../../interface";
import { FUNIQUE_GS4_BLEND_PREPARE, FUNIQUE_GS4_PLYDone, FUNIQUE_GS4_PREPARE } from "./../lua/GS4";

// 從原始資料夾結構 弄成可以工作的樣子
export const GetFUNIQUE_GS4ProjectTemplate_Prepare = ():Task => {
    const sortjob:Job = {
        uuid: uuidv6(),
        category: JobCategory.Execution,
        type: JobType.LUA,
        lua: FUNIQUE_GS4_PREPARE,
        string_args: [],
        number_args: [],
        boolean_args: []
    }
    const createdir:Job = {
        uuid: uuidv6(),
        category: JobCategory.Execution,
        type: JobType.CREATE_DIR,
        lua: "",
        string_args: ["%root%/%after%/GOP_20_I"],
        number_args: [],
        boolean_args: []
    }
    const t:Task = {
        uuid: uuidv6(),
        title: "整理階段",
        description: "從原始資料夾結構 弄成可以工作的樣子",
        cronjob: false,
        cronjobKey: "",
        multi: false,
        multiKey: "",
        properties: [],
        jobs: [
            sortjob,
            createdir
        ]
    }
    return t
}

// 利用 Colmap 工具生成 .bin 資料
export const GetFUNIQUE_GS4ProjectTemplate_Colmap = ():Task => {
    const createsp:Job = {
        uuid: uuidv6(),
        category: JobCategory.Execution,
        type: JobType.CREATE_DIR,
        lua: "",
        string_args: ["%root%/%before%/%ck%/sparse/0"],
        number_args: [],
        boolean_args: []
    }
    const command1:Job = {
        uuid: uuidv6(),
        category: JobCategory.Execution,
        type: JobType.COMMAND,
        lua: "",
        string_args: ["%root%/%before%/%ck%", "colmap", "feature_extractor --database_path sparse/0/database.db --image_path images"],
        number_args: [],
        boolean_args: []
    }
    const command2:Job = {
        uuid: uuidv6(),
        category: JobCategory.Execution,
        type: JobType.COMMAND,
        lua: "",
        string_args: ["%root%/%before%/%ck%", "colmap", "exhaustive_matcher --database_path sparse/0/database.db"],
        number_args: [],
        boolean_args: []
    }
    const command3:Job = {
        uuid: uuidv6(),
        category: JobCategory.Execution,
        type: JobType.COMMAND,
        lua: "",
        string_args: ["%root%/%before%/%ck%", "colmap", "point_triangulator --database sparse/0/database.db --image_path images --input_path ../sparse/0/TXT/edit --output_path sparse/0"],
        number_args: [],
        boolean_args: []
    }
    const deleteion:Job = {
        uuid: uuidv6(),
        category: JobCategory.Execution,
        type: JobType.DELETE_FILE,
        lua: "",
        string_args: ["%root%/%before%/%ck%/sparse/0/database.db"],
        number_args: [],
        boolean_args: []
    }

    const t:Task = {
        uuid: uuidv6(),
        title: "運算資料準備 (COLMAP)",
        description: "利用 Colmap 工具生成 .bin 資料",
        cronjob: true,
        cronjobKey: "frameCount",
        multi: false,
        multiKey: "",
        properties: [],
        jobs: [
            createsp,
            command1,
            command2,
            command3,
            deleteion
        ]
    }
    return t
}

// 生成完整 I-Frame
export const GetFUNIQUE_GS4ProjectTemplate_IFrame = ():Task => {
    const command1:Job = {
        uuid: uuidv6(),
        category: JobCategory.Execution,
        type: JobType.COMMAND,
        lua: "",
        string_args: ["%videogs%", "conda", "run --no-capture-output -n %conda_env% python train_sequence_Good_Full_Train_densify_until_2000_i7000.py --start %gap_value% --end %gap_value_end% --cuda 0 --iframe 1 --data %root%/%before% --output %root%/%after%/GOP_20_I --sh 3 --interval %iframe_gap% --group_size 1 --resolution 1 --iteration %iframe_iteration% --dynamic %finetune_iteration%"],
        number_args: [],
        boolean_args: []
    }
    
    const t:Task = {
        uuid: uuidv6(),
        title: "生成 I Frame",
        description: "生成完整 Frame",
        cronjob: true,
        cronjobKey: "iframe_size",
        multi: false,
        multiKey: "",
        properties: [
            {
                name: 'gap_value',
                expression: '(ck - 1) * iframe_gap + 1'
            },
            {
                name: 'gap_value_end',
                expression: '(ck - 1) * iframe_gap + 2'
            }
        ],
        jobs: [
            command1,
        ]
    }
    return t
}

// 備份 I-Frame
export const GetFUNIQUE_GS4ProjectTemplate_IFrameBackup = ():Task => {
    const backup:Job = {
        uuid: uuidv6(),
        category: JobCategory.Execution,
        type: JobType.COPY_DIR,
        lua: "",
        string_args: ["%root%/%after%/GOP_20_I", "%root%/%after%/GOP_20_I_Backup"],
        number_args: [],
        boolean_args: []
    }
    const t:Task = {
        uuid: uuidv6(),
        title: "備份 I Frame",
        description: "將剛完成的 IFrame 進行備份處理",
        cronjob: false,
        cronjobKey: "",
        multi: false,
        multiKey: "",
        properties: [],
        jobs: [
            backup
        ]
    }
    return t
}

// 把渣渣刪掉 !
export const GetFUNIQUE_GS4ProjectTemplate_Denoise = ():Task => {
    const renamee:Job = {
        uuid: uuidv6(),
        category: JobCategory.Execution,
        type: JobType.RENAME,
        lua: "",
        string_args: ["%root%/%after%/GOP_20_I/checkpoint/%gap_value%/point_cloud/iteration_%iframe_iteration%/point_cloud.ply", "%root%/%after%/GOP_20_I/checkpoint/%gap_value%/point_cloud/iteration_%iframe_iteration%/point_cloud_before.ply"],
        number_args: [],
        boolean_args: []
    }
    const command1:Job = {
        uuid: uuidv6(),
        category: JobCategory.Execution,
        type: JobType.COMMAND,
        lua: "",
        string_args: ["%root%/%after%/GOP_20_I/checkpoint/%gap_value%/point_cloud/iteration_%iframe_iteration%", "ply_denoise", "-i point_cloud_before.ply -o point_cloud.ply -r %denoise% -g %denoise% -b %denoise%"],
        number_args: [],
        boolean_args: []
    }
    const deleted:Job = {
        uuid: uuidv6(),
        category: JobCategory.Execution,
        type: JobType.DELETE_FILE,
        lua: "",
        string_args: ["%root%/%after%/GOP_20_I/checkpoint/%gap_value%/point_cloud/iteration_%iframe_iteration%/point_cloud_before.ply"],
        number_args: [],
        boolean_args: []
    }
    const t:Task = {
        uuid: uuidv6(),
        title: "降躁處理",
        description: "把渣渣刪掉 !",
        cronjob: true,
        cronjobKey: "iframe_size",
        multi: false,
        multiKey: "",
        properties: [
            {
                name: 'gap_value',
                expression: '(ck - 1) * iframe_gap'
            }
        ],
        jobs: [
            renamee,
            command1,
            deleted
        ]
    }
    return t
}

// 排序改變 優化品質做的準備
export const GetFUNIQUE_GS4ProjectTemplate_BlendPrepare = ():Task => {
    const copyhelper:Job = {
        uuid: uuidv6(),
        category: JobCategory.Execution,
        type: JobType.LUA,
        lua: FUNIQUE_GS4_BLEND_PREPARE,
        string_args: [],
        number_args: [],
        boolean_args: []
    }
    const t:Task = {
        uuid: uuidv6(),
        title: "排序改變",
        description: "優化品質複製",
        cronjob: false,
        cronjobKey: "",
        multi: false,
        multiKey: "",
        properties: [],
        jobs: [
            copyhelper
        ]
    }
    return t
}

// Blend 生成多個 checkpoint 資料夾
export const GetFUNIQUE_GS4ProjectTemplate_Checkpoint = ():Task => {
    const command1:Job = {
        uuid: uuidv6(),
        category: JobCategory.Execution,
        type: JobType.COMMAND,
        lua: "",
        string_args: ["%videogs%", "conda", "run --no-capture-output -n %conda_env% python train_sequence_Good_Full_Train_densify_until_2000_i7000.py --density %density_util% --start %gap_value% --end %frameCount% --iframe 0 --data %root%/%before% --output %root%/%after%/BLEND_%blend_value%_I/ --group_size %group_size% --iteration %iteration_iframe% --dynamic %iteration_dynamic% %train_command%"],
        number_args: [],
        boolean_args: []
    }
    const t:Task = {
        uuid: uuidv6(),
        title: "Blend 資料準備",
        description: "生成多個 checkpoint 資料夾",
        cronjob: true,
        cronjobKey: "blend",
        multi: false,
        multiKey: "",
        properties: [
            {
                name: 'gap_value',
                expression: '(ck - 1) * iframe_gap'
            },
            {
                name: 'blend_value',
                expression: '(ck - 1) * iframe_gap'
            }
        ],
        jobs: [
            command1
        ]
    }
    return t
}

// 生成 ply 序列!!
export const GetFUNIQUE_GS4ProjectTemplate_PlyList = ():Task => {
    const sequenceJob:Job = {
        uuid: uuidv6(),
        category: JobCategory.Execution,
        type: JobType.LUA,
        lua: FUNIQUE_GS4_PLYDone,
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
export const GetFUNIQUE_GS4ProjectTemplate_Blend1 = ():Task => {
    const transparentJob:Job = {
        uuid: uuidv6(),
        category: JobCategory.Execution,
        type: JobType.COMMAND,
        lua: "",
        string_args: ["%output%", "ply_blend", "-t 0 -f %index% -b %blend% -g %iframe_gap% -c %contribute% -r %output%/raw -o %output%/trans -x 0"],
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
                expression: '(ck - 1)'
            }
        ],
        jobs: [
            transparentJob
        ]
    }
    return t
}

// 多個 ply 合併
export const GetFUNIQUE_GS4ProjectTemplate_Blend2 = ():Task => {
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
                expression: '(ck - 1)'
            }
        ],
        jobs: [
            mergeJob
        ]
    }
    return t
}

export const GetFUNIQUE_GS4ProjectTemplate = (r:Project):Project => {
    const para:Parameter = {
        canWrite: true,
        containers: [
            { name: "frameCount", value: 20, type: DataType.Number, runtimeOnly: false, hidden: false },
            { name: "iframe_gap", value: 5, type: DataType.Number, runtimeOnly: false, hidden: false },
            { name: "lut_thread", value: 5, type: DataType.Number, runtimeOnly: false, hidden: false },
            { name: "group_size", value: 20, type: DataType.Number, runtimeOnly: false, hidden: false },
            { name: "blend", value: 4, type: DataType.Number, runtimeOnly: false, hidden: false },
            { name: "contribute", value: 1, type: DataType.Number, runtimeOnly: false, hidden: false },
            { name: "iframe_size", value: 0, type: DataType.Number, runtimeOnly: false, hidden: false },
            { name: "denoise", value: 0, type: DataType.Number, runtimeOnly: false, hidden: false },
            { name: "density_util", value: 2000, type: DataType.Number, runtimeOnly: false, hidden: false },
            { name: "iframe_iteration", value: 7000, type: DataType.Number, runtimeOnly: false, hidden: false },
            { name: "finetune_iteration", value: 500, type: DataType.Number, runtimeOnly: false, hidden: false },

            { name: "root", value: "G:/Developer/Funique/4DGS/Test", type: DataType.String, runtimeOnly: false, hidden: false },
            { name: "output", value: "G:/Developer/Funique/4DGS/Test/out", type: DataType.String, runtimeOnly: false, hidden: false },
            { name: "prepare", value: "Prepare", type: DataType.String, runtimeOnly: false, hidden: true },
            { name: "before", value: "before", type: DataType.String, runtimeOnly: false, hidden: true },
            { name: "after", value: "after", type: DataType.String, runtimeOnly: false, hidden: true },
            { name: "CAM", value: "CAM", type: DataType.String, runtimeOnly: false, hidden: true },
            { name: "images", value: "images", type: DataType.String, runtimeOnly: false, hidden: true },
            { name: "sparse", value: "sparse", type: DataType.String, runtimeOnly: false, hidden: true },
            { name: "train_command", value: "--resolution 1 --cuda 0 --sh 3 --interval 1", type: DataType.String, runtimeOnly: false, hidden: false },
            { name: "videogs", value: "C:/videogs/VideoGS", type: DataType.String, runtimeOnly: false, hidden: false },
            { name: "conda_env", value: "videogs", type: DataType.String, runtimeOnly: false, hidden: false },
        ]
    }
    r.parameter = para
    r.task.push(...[
        GetFUNIQUE_GS4ProjectTemplate_Prepare(),
        GetFUNIQUE_GS4ProjectTemplate_Colmap(),
        GetFUNIQUE_GS4ProjectTemplate_IFrame(),
        GetFUNIQUE_GS4ProjectTemplate_IFrameBackup(),
        GetFUNIQUE_GS4ProjectTemplate_Denoise(),
        GetFUNIQUE_GS4ProjectTemplate_BlendPrepare(),
        GetFUNIQUE_GS4ProjectTemplate_Checkpoint(),
        GetFUNIQUE_GS4ProjectTemplate_PlyList(),
        GetFUNIQUE_GS4ProjectTemplate_Blend1(),
        GetFUNIQUE_GS4ProjectTemplate_Blend2()
    ])
    return r
}